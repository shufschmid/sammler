import type { OfferSource } from '../../../types/schema'

// A candidate is one detail page worth scraping and handing to Claude. Discovery is
// cheap (parse an entry page's Markdown) and runs before any per-item scrape, so the
// operation can drop already-known candidates before spending a crawler request.

export interface Candidate {
  source: OfferSource
  /** Stable per-source key for dedup (inserat number, post slug, post id). */
  sourceId: string | null
  /** Canonical detail URL — dedup key and what gets scraped. */
  sourceUrl: string
  /** Whether the detail page needs the headless browser to render. */
  needsPlaywright: boolean
}

/**
 * One public source. `entryUrls` are the listing/search/group pages to scrape for
 * candidate links; `discover` turns one entry page's Markdown into candidates. No
 * per-source detail parsing: the detail Markdown goes to Claude uniformly (extract.ts).
 */
export interface SourceAdapter {
  source: OfferSource
  entryUrls: string[]
  /** Whether entry pages need the headless browser (client-rendered / social). */
  needsPlaywrightForEntry: boolean
  discover(markdown: string): Candidate[]
}
