import { completeJson } from '../../shared/claude'
import { crawlerConfigured, scrape, sleep } from '../../shared/crawler'
import type { Offer, Quelle } from '../../types/schema'

// A short pause between crawler calls so a full run stays under the crawler's rate limit
// (the 429 retry in shared/crawler.ts is the backstop when this is not enough).
const SCRAPE_SPACING_MS = 500
import {
  offerKey,
  selectNewCandidates,
  selectUnclassified,
  slugify
} from './collect'
import {
  buildExtractManyPrompt,
  buildExtractPrompt,
  classificationFields,
  EXTRACT_MANY_SYSTEM_PROMPT,
  EXTRACT_SYSTEM_PROMPT,
  offerFields,
  parseExtraction,
  parseExtractionList
} from './extract'
import { adaptersFor, type Candidate } from './sources'

// The core collection run, shared so the trigger (the offers-collect endpoint) stays a
// thin wrapper. Discovers new Fasnacht offers on the public sources via the crawler,
// stores and classifies them for the Vermittlungsbüro.
//
// Two things keep it safe (root + apps/directus CLAUDE.md):
//   - Bounded: `collectLimit` caps new items per run, so an unusually busy source never
//     turns one run into a surprise crawler/Claude bill.
//   - Idempotent: candidates already stored (by URL or source id) are skipped, and the
//     unique constraint on source_url is the backstop if two runs overlap.
// One dead source (or a missing crawler token) is logged and skipped, never fatal.

export interface CollectOptions {
  collectLimit: number
  classifyLimit: number
  sources?: string[] | string | null
  model?: string | null
}

export interface CollectSummary {
  knownBefore: number
  discoveredBySource: Record<string, number>
  created: number
  classified: number
  skipped: number
  renderers: string[]
}

// The bits of the Directus context this needs — satisfied by both an endpoint and an
// operation handler context.
export interface RunContext {
  services: {
    ItemsService: new (collection: string, options: unknown) => OffersService
  }
  getSchema: () => Promise<unknown>
  logger: {
    warn: (...args: unknown[]) => void
    info: (...args: unknown[]) => void
  }
}

interface OffersService {
  readByQuery(query: unknown): Promise<unknown>
  createOne(data: unknown): Promise<unknown>
  updateOne(key: string, data: unknown): Promise<unknown>
}

function toSourceList(
  sources: CollectOptions['sources']
): string[] | undefined {
  if (Array.isArray(sources)) return sources
  if (typeof sources === 'string' && sources.trim() !== '')
    return sources.split(',').map((entry) => entry.trim())
  return undefined
}

export async function runCollect(
  { collectLimit, classifyLimit, sources, model }: CollectOptions,
  { services, getSchema, logger }: RunContext
): Promise<CollectSummary> {
  const { ItemsService } = services

  // No accountability: this acts as the system so it can read and write every offer.
  const offers = new ItemsService('offers', { schema: await getSchema() })

  // Known keys, read once, to skip candidates cheaply before any detail scrape.
  const known = (await offers.readByQuery({
    limit: -1,
    fields: ['source', 'source_id', 'source_url']
  })) as Array<Pick<Offer, 'source' | 'source_id' | 'source_url'>>

  const knownUrls = new Set<string>()
  const knownKeys = new Set<string>()
  for (const row of known) {
    if (row.source_url) knownUrls.add(row.source_url)
    const key = offerKey(row.source, row.source_id)
    if (key !== null) knownKeys.add(key)
  }

  const modelOption = model ? { model } : {}
  const discoveredBySource: Record<string, number> = {}
  const renderers = new Set<string>()

  // 1. Discovery. Without a crawler token the web sources are simply skipped; the
  //    manual-entry classification pass below still runs.
  const allCandidates: Candidate[] = []
  if (crawlerConfigured()) {
    for (const adapter of adaptersFor(toSourceList(sources))) {
      try {
        let found = 0
        for (const entryUrl of adapter.entryUrls) {
          await sleep(SCRAPE_SPACING_MS)
          const page = await scrape(entryUrl, {
            forcePlaywright: adapter.needsPlaywrightForEntry
          })
          if (page.renderer) renderers.add(page.renderer)
          const candidates = adapter.discover(page.markdown)
          allCandidates.push(...candidates)
          found += candidates.length
        }
        discoveredBySource[adapter.source] = found
      } catch (error) {
        // A dead source must not abort the run — the next run retries it.
        logger.warn(error, `offers-collect: source ${adapter.source} failed`)
      }
    }
  } else {
    logger.info('offers-collect: no CRAWLER_TOKEN, skipping web sources')
  }

  // 2. Scrape + extract each new candidate, store the ones Claude confirms as offers.
  const selected = selectNewCandidates(
    allCandidates,
    knownUrls,
    knownKeys,
    collectLimit
  )
  let created = 0
  let skipped = 0

  for (const candidate of selected) {
    try {
      await sleep(SCRAPE_SPACING_MS)
      const page = await scrape(candidate.sourceUrl, {
        forcePlaywright: candidate.needsPlaywright
      })
      if (page.renderer) renderers.add(page.renderer)

      const extraction = parseExtraction(
        await completeJson<unknown>({
          system: EXTRACT_SYSTEM_PROMPT,
          prompt: buildExtractPrompt(
            candidate.source,
            candidate.sourceUrl,
            page.markdown
          ),
          maxTokens: 1024,
          ...modelOption
        })
      )

      if (!extraction.isOffer) {
        skipped += 1
        continue
      }

      await offers.createOne({
        status: 'new',
        ...offerFields(candidate, page.markdown, extraction, new Date())
      })
      created += 1
    } catch (error) {
      // Includes the unique-constraint race on source_url when runs overlap.
      skipped += 1
      logger.warn(
        error,
        `offers-collect: candidate ${candidate.sourceUrl} skipped`
      )
    }
  }

  // 2b. Custom sources the redaction added in the dashboard. Each is one page that may
  //     list several offers, so Claude extracts an array (extract-many). Offers are keyed
  //     by (custom, quelle:slug) and get a per-offer anchor URL for dedup.
  if (crawlerConfigured()) {
    const quellen = (await new ItemsService('quellen', {
      schema: await getSchema()
    }).readByQuery({
      filter: { active: { _eq: true } },
      limit: 50,
      fields: ['id', 'name', 'url', 'needs_playwright']
    })) as Array<Pick<Quelle, 'id' | 'name' | 'url' | 'needs_playwright'>>

    let customFound = 0
    for (const quelle of quellen) {
      try {
        await sleep(SCRAPE_SPACING_MS)
        const page = await scrape(quelle.url, {
          forcePlaywright: quelle.needs_playwright === true
        })
        if (page.renderer) renderers.add(page.renderer)

        const extracted = parseExtractionList(
          await completeJson<unknown>({
            system: EXTRACT_MANY_SYSTEM_PROMPT,
            prompt: buildExtractManyPrompt(
              quelle.name,
              quelle.url,
              page.markdown
            ),
            maxTokens: 4096,
            ...modelOption
          })
        ).slice(0, collectLimit)

        for (const item of extracted) {
          const sid = `${quelle.id}:${slugify(item.title)}`
          const url = item.link ?? `${quelle.url}#${slugify(item.title)}`
          if (knownUrls.has(url) || knownKeys.has(`custom:${sid}`)) continue
          knownUrls.add(url)
          knownKeys.add(`custom:${sid}`)

          try {
            await offers.createOne({
              status: 'new',
              ...offerFields(
                { source: 'custom', sourceId: sid, sourceUrl: url },
                item.summary ?? item.title,
                {
                  isOffer: true,
                  title: item.title,
                  category: item.category,
                  summary: item.summary,
                  audience: item.audience,
                  contact: item.contact,
                  listedAt: item.listedAt,
                  evergreen: item.evergreen
                },
                new Date()
              )
            })
            created += 1
            customFound += 1
          } catch (error) {
            skipped += 1
            logger.warn(error, `offers-collect: custom offer ${url} skipped`)
          }
        }
      } catch (error) {
        // One dead custom source must not abort the run.
        logger.warn(error, `offers-collect: quelle ${quelle.url} failed`)
      }
    }
    if (quellen.length > 0) discoveredBySource['custom'] = customFound
  }

  // 3. Classify offers that were stored without a scrape (manual entries).
  const pending = (await offers.readByQuery({
    filter: { ai_generated_at: { _null: true }, status: { _neq: 'dismissed' } },
    limit: 200,
    fields: ['id', 'title', 'raw_text', 'ai_generated_at', 'status', 'source']
  })) as Array<
    Pick<Offer, 'id' | 'title' | 'raw_text' | 'ai_generated_at' | 'status'>
  >

  let classified = 0
  for (const offer of selectUnclassified(pending, classifyLimit)) {
    try {
      const extraction = parseExtraction(
        await completeJson<unknown>({
          system: EXTRACT_SYSTEM_PROMPT,
          prompt: buildExtractPrompt(
            'manual',
            '',
            [offer.title, offer.raw_text ?? ''].join('\n\n')
          ),
          maxTokens: 1024,
          ...modelOption
        })
      )

      await offers.updateOne(
        offer.id,
        classificationFields(extraction, new Date())
      )
      classified += 1
    } catch (error) {
      logger.warn(error, `offers-collect: could not classify offer ${offer.id}`)
    }
  }

  return {
    knownBefore: known.length,
    discoveredBySource,
    created,
    classified,
    skipped,
    renderers: [...renderers]
  }
}
