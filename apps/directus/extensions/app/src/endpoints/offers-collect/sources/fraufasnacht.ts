import type { Candidate, SourceAdapter } from './types'

// fraufasnacht.ch/marktplatz — TYPO3 classifieds, server-rendered. Listing pages link
// to detail pages carrying a monotonically increasing numeric inserat id, which is the
// stable dedup key. Detail pages render without the cHash query parameter, so a
// canonical id-only URL is enough both to scrape and to dedup on.

export const FRAUFASNACHT_BASE = 'https://fraufasnacht.ch/'

// The ikat category codes worth scanning: Aktive, Helfer, the Flohmarkt subcategories
// (instruments, larvae, costumes, requisites, figures, plaques, misc) and "Verein
// gesucht". These are where Vermittlungsbüro items actually appear.
export const FRAUFASNACHT_CATEGORIES = [
  '2_0',
  '3_0',
  '10_51',
  '10_52',
  '10_53',
  '10_54',
  '10_55',
  '10_56',
  '10_57',
  '10_74'
] as const

const INSERAT_ID = /inserate(?:%5D|\])=(\d+)/g

/** Canonical, cHash-free detail URL for an inserat id — stable across time. */
export function detailUrl(id: string): string {
  return (
    `${FRAUFASNACHT_BASE}marktplatz/detailansicht/?tx_fraufasnacht_inserate[inserate]=${id}` +
    `&tx_fraufasnacht_inserate[action]=show&tx_fraufasnacht_inserate[controller]=Inserate`
  )
}

/**
 * Finds every inserat id in a listing page's Markdown and turns each into one
 * candidate. Deduplicates within the page; the operation deduplicates across runs.
 */
export function discover(markdown: string): Candidate[] {
  const seen = new Set<string>()
  const candidates: Candidate[] = []

  for (const match of markdown.matchAll(INSERAT_ID)) {
    const id = match[1]
    if (id === undefined || seen.has(id)) continue
    seen.add(id)
    candidates.push({
      source: 'fraufasnacht',
      sourceId: id,
      sourceUrl: detailUrl(id),
      needsPlaywright: false
    })
  }

  return candidates
}

export const fraufasnachtAdapter: SourceAdapter = {
  source: 'fraufasnacht',
  entryUrls: FRAUFASNACHT_CATEGORIES.map(
    (category) => `${FRAUFASNACHT_BASE}marktplatz/ikat/${category}`
  ),
  needsPlaywrightForEntry: false,
  discover
}
