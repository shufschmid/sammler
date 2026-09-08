import { optionalEnv, requireEnv } from './env'

// The single place where this application reaches the wepublish crawler
// (crawler.wepublish.dev). It turns a URL into Markdown, falling back to a headless
// browser when a page renders client-side — which is how the offers-collect Flow can
// read JS-only sources (Unimarkt) and social pages the same way it reads plain HTML.
//
// This is a deliberate second outbound dependency next to the Claude API (root
// CLAUDE.md, constraint 4): a wepublish-internal shared service. Keep every call to
// it behind this module, exactly as every model call goes through shared/claude.ts.

export const DEFAULT_CRAWLER_URL = 'https://crawler.wepublish.dev'
const DEFAULT_TIMEOUT_MS = 30_000

/**
 * The seam every crawler call goes through. `path` is a crawler route ("/v1/scrape"),
 * `body` the JSON request. Handlers and tests can pass a stub and never touch the
 * network — the same pattern as `MessageSender` in shared/claude.ts.
 */
export type CrawlerFetcher = (path: string, body: unknown) => Promise<unknown>

export class CrawlerError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause })
    this.name = 'CrawlerError'
  }
}

/**
 * The default fetcher: a POST to the crawler with the bearer token. Requires
 * CRAWLER_TOKEN — callers that treat the crawler as optional must check for the token
 * (via optionalEnv) before invoking anything that uses this.
 */
const MAX_RETRIES = 4

/** Small helper so callers can space out their crawler calls to stay under the limit. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const postToCrawler: CrawlerFetcher = async (path, body) => {
  const base = optionalEnv('CRAWLER_URL', DEFAULT_CRAWLER_URL).replace(
    /\/+$/,
    ''
  )
  const token = requireEnv('CRAWLER_TOKEN')

  // A full collect run fires many scrapes in a row; the crawler rate-limits bursts with
  // 429. Retry those with a backoff (honouring Retry-After) so one run does not throttle
  // itself into empty results. Other errors fail fast.
  for (let attempt = 0; ; attempt++) {
    let response: Response
    try {
      response = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS)
      })
    } catch (cause) {
      // Network error or timeout — never leak the token-bearing request object.
      throw new CrawlerError(`Crawler request to ${path} failed`, cause)
    }

    if (response.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = Number(response.headers.get('retry-after'))
      const waitMs =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : 1500 * (attempt + 1)
      await sleep(waitMs)
      continue
    }

    if (!response.ok) {
      throw new CrawlerError(`Crawler answered ${response.status} for ${path}`)
    }

    try {
      return await response.json()
    } catch (cause) {
      throw new CrawlerError(`Crawler returned no JSON for ${path}`, cause)
    }
  }
}

/** True when a crawler token is configured; callers use this to skip web sources. */
export function crawlerConfigured(): boolean {
  return optionalEnv('CRAWLER_TOKEN', '') !== ''
}

export interface ScrapeResult {
  markdown: string
  /** 'httpx' | 'playwright' | 'none' — which path the crawler took, for the Flow log. */
  renderer: string | null
}

export interface ScrapeOptions {
  forcePlaywright?: boolean
}

/**
 * Scrapes a single URL to Markdown. `forcePlaywright` renders the page in a headless
 * browser even when the plain fetch returns something — needed for client-rendered
 * sources (Unimarkt, Facebook).
 */
export async function scrape(
  url: string,
  options: ScrapeOptions = {},
  fetcher: CrawlerFetcher = postToCrawler
): Promise<ScrapeResult> {
  const raw = await fetcher('/v1/scrape', {
    url,
    formats: ['markdown'],
    force_playwright: options.forcePlaywright ?? false
  })

  return parseScrapeResult(raw)
}

/**
 * Pulls the Markdown and renderer out of a crawler response. Kept separate so tests
 * cover the parsing without a network call. The crawler wraps its payload under
 * `data`, Firecrawl-compatibly; tolerate a flat shape too.
 */
export function parseScrapeResult(raw: unknown): ScrapeResult {
  if (typeof raw !== 'object' || raw === null) {
    throw new CrawlerError('Crawler response is not an object.')
  }

  const envelope = raw as {
    data?: unknown
    markdown?: unknown
    metadata?: unknown
  }
  const data =
    typeof envelope.data === 'object' && envelope.data !== null
      ? (envelope.data as { markdown?: unknown; metadata?: unknown })
      : envelope

  const markdown = data.markdown
  if (typeof markdown !== 'string') {
    throw new CrawlerError('Crawler response has no markdown.')
  }

  const metadata =
    typeof data.metadata === 'object' && data.metadata !== null
      ? (data.metadata as { renderer?: unknown })
      : {}
  const renderer =
    typeof metadata.renderer === 'string' ? metadata.renderer : null

  return { markdown, renderer }
}
