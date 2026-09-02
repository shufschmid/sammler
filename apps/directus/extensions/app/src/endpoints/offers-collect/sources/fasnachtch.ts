import { absoluteUrl, extractLinks } from './markdown'
import type { Candidate, SourceAdapter } from './types'

// fasnacht.ch — WordPress news, server-rendered. Mostly editorial, so only a minority
// of articles are actual Vermittlungsbüro material ("… gesucht", "zu verkaufen"). A
// keyword prefilter on the link text keeps the candidate list (and the Claude calls)
// small; Claude still gets the final say via isOffer during extraction.

export const FASNACHTCH_BASE = 'https://fasnacht.ch/'

const OFFER_KEYWORDS = [
  'gesucht',
  'sucht',
  'suche',
  'zu verkaufen',
  'verkaufe',
  'abzugeben',
  'zu verschenken',
  'verschenke',
  'helfer',
  'helferinnen',
  'laterne',
  'laternen',
  'gratis'
]

/** True when a headline reads like an offer/request rather than plain news. */
export function looksLikeOffer(text: string): boolean {
  const lower = text.toLowerCase()
  return OFFER_KEYWORDS.some((keyword) => lower.includes(keyword))
}

/** Trailing slug of a fasnacht.ch article URL, the stable per-article key. */
function slugOf(url: string): string | null {
  const path = new URL(url).pathname.replace(/\/+$/, '')
  const slug = path.split('/').pop()
  return slug === undefined || slug === '' ? null : slug
}

/**
 * Extracts article links whose text looks like an offer. One candidate per unique
 * article slug on the fasnacht.ch domain.
 */
export function discover(markdown: string): Candidate[] {
  const seen = new Set<string>()
  const candidates: Candidate[] = []

  for (const link of extractLinks(markdown)) {
    if (!looksLikeOffer(link.text)) continue

    const url = absoluteUrl(link.url, FASNACHTCH_BASE)
    if (url === null) continue

    const parsed = new URL(url)
    if (
      parsed.hostname !== 'fasnacht.ch' &&
      parsed.hostname !== 'www.fasnacht.ch'
    )
      continue
    // Skip category/tag/author index pages — only real article slugs.
    if (/^\/(category|tag|author|page)\//i.test(parsed.pathname)) continue

    const slug = slugOf(url)
    if (slug === null || seen.has(slug)) continue
    seen.add(slug)

    candidates.push({
      source: 'fasnacht_ch',
      sourceId: slug,
      sourceUrl: `${FASNACHTCH_BASE}${slug}/`,
      needsPlaywright: false
    })
  }

  return candidates
}

export const fasnachtchAdapter: SourceAdapter = {
  source: 'fasnacht_ch',
  entryUrls: [FASNACHTCH_BASE],
  needsPlaywrightForEntry: false,
  discover
}
