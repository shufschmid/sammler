import { scrape, sleep } from './crawler'

// Shared skeleton for "scrape a list page → extract many rows → dedup → store", reused by
// collectors (the Wohnungen run, and optionally the offers custom-sources path). It owns
// only the collector-agnostic parts: iterate sources, scrape each with a polite pause and
// 429-retry (in shared/crawler), track renderers, isolate per-source failures and collect
// the first few for the run summary. The collector supplies `handle`, which does the
// Claude extraction, dedup and create for one page.

export interface PageSource {
  /** The `source` value to store on created rows. */
  source: string
  /** Human name for the extraction prompt and logs. */
  name: string
  /** The page to scrape. */
  url: string
  needsPlaywright: boolean
}

/** What `handle` reports back for one page. */
export interface PageResult {
  found: number
  created: number
  skipped: number
}

export type PageHandler = (markdown: string, src: PageSource) => Promise<PageResult>

export interface CollectDeps {
  logger: { warn: (...args: unknown[]) => void; info: (...args: unknown[]) => void }
  spacingMs?: number
}

export interface CollectStats {
  discoveredBySource: Record<string, number>
  created: number
  skipped: number
  renderers: string[]
  errors: string[]
}

const DEFAULT_SPACING_MS = 500
const MAX_ERRORS = 8

export async function collectFromPages(
  sources: PageSource[],
  { logger, spacingMs = DEFAULT_SPACING_MS }: CollectDeps,
  handle: PageHandler
): Promise<CollectStats> {
  const discoveredBySource: Record<string, number> = {}
  const renderers = new Set<string>()
  const errors: string[] = []
  let created = 0
  let skipped = 0

  const noteError = (context: string, error: unknown) => {
    if (errors.length >= MAX_ERRORS) return
    errors.push(`${context}: ${error instanceof Error ? error.message : String(error)}`)
  }

  for (const src of sources) {
    try {
      await sleep(spacingMs)
      const page = await scrape(src.url, { forcePlaywright: src.needsPlaywright })
      if (page.renderer) renderers.add(page.renderer)

      const result = await handle(page.markdown, src)
      created += result.created
      skipped += result.skipped
      discoveredBySource[src.source] =
        (discoveredBySource[src.source] ?? 0) + result.found
    } catch (error) {
      // One dead source must not abort the run — the next run retries it.
      noteError(src.name, error)
      logger.warn(error, `collect: source ${src.name} (${src.url}) failed`)
    }
  }

  return {
    discoveredBySource,
    created,
    skipped,
    renderers: [...renderers],
    errors
  }
}
