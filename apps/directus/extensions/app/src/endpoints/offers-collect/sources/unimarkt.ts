import { absoluteUrl, extractLinks } from './markdown'
import type { Candidate, SourceAdapter } from './types'

// markt.unibas.ch ("Unimarkt") — Uni Basel marketplace, Next.js + client-side search.
// The plain HTML has no listings, so the entry (search) page must be rendered with the
// headless browser. Post detail pages are client-rendered too. The post slug is the
// stable dedup key; posts expire (404) but that only means a later scrape finds fewer.

export const UNIMARKT_BASE = 'https://markt.unibas.ch'

// Search terms broad enough to catch the usual Fasnacht items (Laternenträger,
// Servicekräfte, Kostüme). One entry page per term.
export const UNIMARKT_QUERIES = ['fasnacht', 'laterne'] as const

const POST_PATH = /\/post\/[a-z0-9-]+$/i

/** Slug segment of a /post/<slug> URL, the stable per-post key. */
function slugOf(url: string): string | null {
  const match = url.match(/\/post\/([a-z0-9-]+)/i)
  return match?.[1] ?? null
}

/**
 * Extracts /post/<slug> detail links from a rendered search page's Markdown. One
 * candidate per unique slug.
 */
export function discover(markdown: string): Candidate[] {
  const seen = new Set<string>()
  const candidates: Candidate[] = []

  for (const link of extractLinks(markdown)) {
    const url = absoluteUrl(link.url, UNIMARKT_BASE)
    if (url === null) continue

    const path = new URL(url).pathname
    if (!POST_PATH.test(path)) continue

    const slug = slugOf(url)
    if (slug === null || seen.has(slug)) continue
    seen.add(slug)

    candidates.push({
      source: 'unimarkt',
      sourceId: slug,
      sourceUrl: `${UNIMARKT_BASE}/post/${slug}`,
      needsPlaywright: true
    })
  }

  return candidates
}

export const unimarktAdapter: SourceAdapter = {
  source: 'unimarkt',
  entryUrls: UNIMARKT_QUERIES.map(
    (query) => `${UNIMARKT_BASE}/search?q=${encodeURIComponent(query)}`
  ),
  needsPlaywrightForEntry: true,
  discover
}
