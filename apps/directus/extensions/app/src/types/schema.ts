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

/** Which Sammler activity a custom source belongs to. */
export type Collector = 'vermittlungsbuero' | 'wohnungen'

/** A source the redaction added in the dashboard for a collect run to search. */
export interface Quelle {
  id: string
  collector: Collector
  name: string
  url: string
  needs_playwright: boolean
  active: boolean
  date_created: string | null
}

// Wohnungen: one cheap-apartment listing collected for the weekly briefing box.

export type WohnungStatus =
  | 'neu'
  | 'geprueft'
  | 'aufgenommen'
  | 'im_briefing'
  | 'weg'
  | 'verworfen'

export type WohnungSource =
  | 'unimarkt'
  | 'immobilien_bs'
  | 'genossenschaft'
  | 'homegate'
  | 'immoscout'
  | 'flatfox'
  | 'facebook'
  | 'mail'
  | 'manuell'
  | 'custom'

export interface Wohnung {
  id: string
  status: WohnungStatus
  source: WohnungSource
  source_id: string | null
  /** Link to the listing. Unique = dedup key. */
  source_url: string | null
  plattform: string | null
  titel: string
  beschreibung: string | null
  zimmer: number | null
  flaeche_m2: number | null
  miete_chf: number | null
  /** Computed in the hook: miete_chf / flaeche_m2. */
  miete_pro_m2: number | null
  adresse: string | null
  plz: string | null
  quartier: string | null
  listed_at: string | null
  // Claude-extracted criteria flags.
  ai_genossenschaft: boolean | null
  ai_moebliert: boolean | null
  ai_untermiete: boolean | null
  ai_befristet: boolean | null
  ai_wg: boolean | null
  /** Meets the criteria — computed in the hook, not by Claude. */
  ai_passt: boolean | null
  ai_passt_grund: string | null
  /** The two-sentence briefing text. */
  ai_kurztext: string | null
  ai_generated_at: string | null
  date_created: string | null
  date_updated: string | null
}

export interface Schema {
  offers: Offer[]
  quellen: Quelle[]
  wohnungen: Wohnung[]
}
