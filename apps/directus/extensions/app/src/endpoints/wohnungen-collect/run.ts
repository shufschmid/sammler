import { completeJson } from '../../shared/claude'
import { crawlerConfigured } from '../../shared/crawler'
import { collectFromPages, type PageSource } from '../../shared/collect-pages'
import {
  fetchUnreadMail,
  mailboxConfigured,
  type MailFetcher
} from '../../shared/mailbox'
import type { Quelle, Wohnung } from '../../types/schema'
import {
  buildExtractMailPrompt,
  buildExtractManyPrompt,
  EXTRACT_MANY_SYSTEM_PROMPT,
  parseWohnungList,
  wohnungFields
} from './extract'
import { WOHNUNG_SOURCES } from './sources'

// The Wohnungen collect run: scrape the built-in cooperative/Unimarkt/Immobilien-BS
// sources plus any active custom `quellen` (collector=wohnungen), extract apartments with
// Claude, store new ones. A second pass reads unread newsletter/reader mail over IMAP and
// extracts flats from it too. Bounded and idempotent (dedup on source_url / source+key).
// One dead source is logged and skipped. Runs from a Schedule Flow (weekly) and a button.

const MAX_MAILS_PER_RUN = 30

export interface WohnungCollectOptions {
  collectLimit: number
  model?: string | null
}

export interface WohnungCollectSummary {
  knownBefore: number
  crawlerConfigured: boolean
  mailboxConfigured: boolean
  discoveredBySource: Record<string, number>
  created: number
  skipped: number
  renderers: string[]
  errors: string[]
}

interface WohnungenService {
  readByQuery(query: unknown): Promise<unknown>
  createOne(data: unknown): Promise<unknown>
}

export interface RunContext {
  services: {
    ItemsService: new (collection: string, options: unknown) => WohnungenService
  }
  getSchema: () => Promise<unknown>
  logger: {
    warn: (...args: unknown[]) => void
    info: (...args: unknown[]) => void
  }
  /** Injectable for tests; defaults to the real IMAP reader. */
  fetchMail?: MailFetcher
}

function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'wohnung'
  )
}

export async function runWohnungenCollect(
  { collectLimit, model }: WohnungCollectOptions,
  { services, getSchema, logger, fetchMail = fetchUnreadMail }: RunContext
): Promise<WohnungCollectSummary> {
  const { ItemsService } = services
  const schema = await getSchema()
  const wohnungen = new ItemsService('wohnungen', { schema })

  const known = (await wohnungen.readByQuery({
    limit: -1,
    fields: ['source', 'source_id', 'source_url']
  })) as Array<Pick<Wohnung, 'source' | 'source_id' | 'source_url'>>

  const knownUrls = new Set<string>()
  const knownKeys = new Set<string>()
  for (const row of known) {
    if (row.source_url) knownUrls.add(row.source_url)
    if (row.source_id) knownKeys.add(`${row.source}:${row.source_id}`)
  }

  const webConfigured = crawlerConfigured()
  const mailConfigured = mailboxConfigured()
  if (!webConfigured && !mailConfigured) {
    logger.info(
      'wohnungen-collect: no CRAWLER_TOKEN and no mailbox — nothing to collect'
    )
    return {
      knownBefore: known.length,
      crawlerConfigured: false,
      mailboxConfigured: false,
      discoveredBySource: {},
      created: 0,
      skipped: 0,
      renderers: [],
      errors: []
    }
  }

  const modelOption = model ? { model } : {}
  const discoveredBySource: Record<string, number> = {}
  const renderers = new Set<string>()
  const errors: string[] = []
  let createdTotal = 0
  let skippedTotal = 0

  // Dedup + create for one batch of extracted flats. Shared by the web and mail passes so
  // both apply the same source_url / source+key dedup and honour collectLimit.
  const store = async (
    items: Awaited<ReturnType<typeof parseWohnungList>>,
    meta: {
      source: Wohnung['source']
      baseUrl: string
      plattform: string
      listedAt: Date | null
    }
  ): Promise<{ created: number; skipped: number }> => {
    let created = 0
    let skipped = 0
    for (const item of items) {
      if (createdTotal >= collectLimit) {
        skipped += 1
        continue
      }
      const key = slug(item.adresse ?? item.titel)
      const url = item.link ?? `${meta.baseUrl}#${key}`
      if (knownUrls.has(url) || knownKeys.has(`${meta.source}:${key}`)) {
        skipped += 1
        continue
      }
      knownUrls.add(url)
      knownKeys.add(`${meta.source}:${key}`)

      try {
        await wohnungen.createOne({
          status: 'neu',
          ...(meta.listedAt ? { listed_at: meta.listedAt.toISOString() } : {}),
          ...wohnungFields(
            {
              source: meta.source,
              sourceId: key,
              sourceUrl: url,
              plattform: meta.plattform
            },
            item,
            new Date()
          )
        })
        created += 1
        createdTotal += 1
      } catch (error) {
        skipped += 1
        logger.warn(error, `wohnungen-collect: could not store ${url}`)
      }
    }
    return { created, skipped }
  }

  // Pass 1 — web sources: built-in list + active custom quellen for this collector.
  if (webConfigured) {
    const quellen = (await new ItemsService('quellen', { schema }).readByQuery({
      filter: { active: { _eq: true }, collector: { _eq: 'wohnungen' } },
      limit: 50,
      fields: ['name', 'url', 'needs_playwright']
    })) as Array<Pick<Quelle, 'name' | 'url' | 'needs_playwright'>>

    const sources: PageSource[] = [
      ...WOHNUNG_SOURCES,
      ...quellen.map((q) => ({
        source: 'custom' as const,
        name: q.name,
        url: q.url,
        needsPlaywright: q.needs_playwright === true
      }))
    ]

    const stats = await collectFromPages(
      sources,
      { logger },
      async (markdown, src) => {
        const items = parseWohnungList(
          await completeJson<unknown>({
            system: EXTRACT_MANY_SYSTEM_PROMPT,
            prompt: buildExtractManyPrompt(src.name, src.url, markdown),
            maxTokens: 4096,
            ...modelOption
          })
        )
        const { created, skipped } = await store(items, {
          source: src.source as Wohnung['source'],
          baseUrl: src.url,
          plattform: src.name,
          listedAt: null
        })
        return { found: items.length, created, skipped }
      }
    )

    for (const [k, v] of Object.entries(stats.discoveredBySource))
      discoveredBySource[k] = v
    for (const r of stats.renderers) renderers.add(r)
    errors.push(...stats.errors)
    skippedTotal += stats.skipped
  }

  // Pass 2 — unread newsletter/reader mail over IMAP. Each message may hold several flats.
  if (mailConfigured) {
    try {
      const mails = await fetchMail(MAX_MAILS_PER_RUN)
      renderers.add('imap')
      for (const mail of mails) {
        try {
          const items = parseWohnungList(
            await completeJson<unknown>({
              system: EXTRACT_MANY_SYSTEM_PROMPT,
              prompt: buildExtractMailPrompt(
                mail.subject,
                mail.from,
                mail.text
              ),
              maxTokens: 4096,
              ...modelOption
            })
          )
          const { skipped } = await store(items, {
            source: 'mail',
            baseUrl: `mailto:${mail.from || 'unbekannt'}?uid=${mail.uid}`,
            plattform: mail.from || 'Mail',
            listedAt: mail.date
          })
          discoveredBySource['mail'] =
            (discoveredBySource['mail'] ?? 0) + items.length
          skippedTotal += skipped
        } catch (error) {
          if (errors.length < 8)
            errors.push(
              `Mail ${mail.uid}: ${error instanceof Error ? error.message : String(error)}`
            )
          logger.warn(
            error,
            `wohnungen-collect: could not process mail ${mail.uid}`
          )
        }
      }
    } catch (error) {
      if (errors.length < 8)
        errors.push(
          `IMAP: ${error instanceof Error ? error.message : String(error)}`
        )
      logger.warn(error, 'wohnungen-collect: IMAP pass failed')
    }
  }

  return {
    knownBefore: known.length,
    crawlerConfigured: webConfigured,
    mailboxConfigured: mailConfigured,
    discoveredBySource,
    created: createdTotal,
    skipped: skippedTotal,
    renderers: [...renderers],
    errors
  }
}
