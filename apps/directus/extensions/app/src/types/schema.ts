// Typed view of the collections this application owns.
//
// Keep it in sync with the data model by hand, or regenerate it: the bundled
// `directus-extension-ts-typegen` module (Settings → TypeScript Types in the
// admin UI) writes these types from the live schema. Paste the result here and
// keep the hand-written notes.
//
// The frontend does NOT import this file — it is a separate npm package. It
// generates its own types from the GraphQL schema (`npm run codegen` in
// apps/front). One data model, two generated views of it.

// Vermittlungsbüro: one Fasnacht classified (offer or request) collected from a
// public source (or entered by hand), classified by Claude for the briefing ticker.

export type OfferStatus =
  'new' | 'reviewed' | 'accepted' | 'dismissed' | 'published'

/**
 * Where an offer came from. `manual` = entered in the panel (Facebook, reader mail);
 * `custom` = scraped from a source the redaction added in the `quellen` collection.
 */
export type OfferSource =
  'fraufasnacht' | 'unimarkt' | 'fasnacht_ch' | 'facebook' | 'manual' | 'custom'

/** What kind of classified this is, decided by Claude. */
export type OfferCategory = 'sucht' | 'bietet' | 'verkauft'

export interface Offer {
  id: string
  status: OfferStatus
  source: OfferSource
  /** Stable per-source key (inserat number, post slug, feed guid); null for manual. */
  source_id: string | null
  /** Dedup key. Unique in Postgres, which permits many NULLs (manual entries). */
  source_url: string | null
  title: string
  raw_text: string | null
  contact: string | null
  /** Date the source showed for the listing (not when we found it). */
  listed_at: string | null
  /**
   * Written only by the offers-collect operation. Each part in its own field so the
   * frontend never parses a packed string apart.
   */
  ai_category: OfferCategory | null
  ai_summary: string | null
  ai_audience: string | null
  /** True for a long-valid search call (e.g. "sucht unveröffentlichte Trommelmärsche"). */
  ai_evergreen: boolean | null
  ai_generated_at: string | null
  date_created: string | null
  date_updated: string | null
}

/** A source the redaction added in the dashboard for offers-collect to search. */
export interface Quelle {
  id: string
  name: string
  url: string
  needs_playwright: boolean
  active: boolean
  date_created: string | null
}

export interface Schema {
  offers: Offer[]
  quellen: Quelle[]
}
