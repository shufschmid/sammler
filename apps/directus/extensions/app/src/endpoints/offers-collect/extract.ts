import type { OfferCategory, OfferSource } from '../../types/schema'

// Pure prompt building and answer validation for turning a scraped page (Markdown) into
// structured Vermittlungsbüro entries. No network here — see extract.test.ts. Two shapes:
// a single-offer extraction (one detail page → one offer) and a multi-offer extraction
// (a custom source's listing page → many offers). Both decide isOffer/evergreen and
// produce the ticker-ready fields.

const SOURCE_LABELS: Record<OfferSource, string> = {
  fraufasnacht: 'Marktplatz von fraufasnacht.ch',
  unimarkt: 'Unimarkt der Uni Basel',
  fasnacht_ch: 'News-Seite fasnacht.ch',
  facebook: 'Facebook-Gruppe «Rund um d’Fasnacht Basel & Regio»',
  manual: 'manuell erfasst',
  custom: 'zusaetzliche Quelle'
}

// Shared field rules, reused by both prompts so the two cannot drift.
const FIELD_RULES = [
  'category: "sucht" wenn jemand etwas oder jemanden sucht, "bietet" fuer Dienstleistungen/Verschenken/Hilfe, "verkauft" fuer Verkaeufe. null wenn unklar.',
  'summary: EIN Satz im Ticker-Stil des Briefings, hoechstens 200 Zeichen, Gegenwart, sachlich, auf Deutsch. Beispiele: «Die Clique X sucht Laternenzieher*innen» oder «Verkauft wird ein Fasnachtswagen».',
  'audience: an wen sich das Inserat richtet (z. B. «Cliquen», «Guggen», «Aktive», «Sammler*innen») oder null.',
  'contact: Name, Telefon oder E-Mail in einer Zeile, falls im Text vorhanden. «ät», «(at)» oder «[at]» bedeutet «@». Erfinde niemals Kontaktdaten; fehlt eine Angabe, gib null.',
  'listedAt: das im Text genannte Datum als ISO (YYYY-MM-DD), sonst null. Formate wie «30-08-26» bedeuten Tag-Monat-Jahr.',
  'evergreen: true, wenn das Inserat dauerhaft gueltig bleibt und nicht an einen baldigen Termin gebunden ist (z. B. ein langfristiger Suchaufruf wie «sucht unveroeffentlichte Trommelmaersche fuer ein Buchprojekt»). false fuer zeitgebundene Inserate (konkreter Anlass, Fasnacht dieses Jahres, baldiges Datum).',
  'Erfinde nichts, was nicht im Text steht.'
]

export const EXTRACT_SYSTEM_PROMPT = [
  'Du wertest Inserate rund um die Basler Fasnacht fuer die Rubrik «Vermittlungsbuero» des Fasnachts-Briefings aus.',
  'Du bekommst den Text einer einzelnen Seite als Markdown und gibst genau ein JSON-Objekt zurueck.',
  'Form: {"isOffer": boolean, "title": string, "category": "sucht"|"bietet"|"verkauft"|null, "summary": string, "audience": string|null, "contact": string|null, "listedAt": string|null, "evergreen": boolean}.',
  'isOffer ist false, wenn die Seite kein konkretes Angebot oder Gesuch rund um die Fasnacht ist (z. B. reine News, Werbung, Navigation, Login-Wand). Dann duerfen die anderen Felder leer/null sein.',
  ...FIELD_RULES
].join('\n')

export const EXTRACT_MANY_SYSTEM_PROMPT = [
  'Du wertest eine Seite mit mehreren Inseraten rund um die Basler Fasnacht fuer die Rubrik «Vermittlungsbuero» aus.',
  'Du bekommst den Text der Seite als Markdown und gibst genau ein JSON-Objekt {"offers": [...]} zurueck.',
  'Jeder Eintrag im Array hat die Form {"title": string, "category": "sucht"|"bietet"|"verkauft"|null, "summary": string, "audience": string|null, "contact": string|null, "listedAt": string|null, "evergreen": boolean, "link": string|null}.',
  'Nimm nur konkrete Angebote oder Gesuche rund um die Fasnacht auf. Ueberspringe News, Werbung, Navigation. Gibt es keine, ist "offers" ein leeres Array.',
  'link: die URL, die zu genau diesem Inserat gehoert, falls im Markdown vorhanden, sonst null.',
  ...FIELD_RULES
].join('\n')

export class EmptyPageError extends Error {
  constructor() {
    super('Die Seite enthaelt keinen auswertbaren Text.')
    this.name = 'EmptyPageError'
  }
}

const MAX_MARKDOWN = 8000

export function buildExtractPrompt(
  source: OfferSource,
  url: string,
  markdown: string
): string {
  const text = markdown.trim()
  if (text === '') throw new EmptyPageError()

  return [
    `Quelle: ${SOURCE_LABELS[source]}`,
    `URL: ${url}`,
    '',
    'Seiteninhalt (Markdown):',
    text.slice(0, MAX_MARKDOWN)
  ].join('\n')
}

export function buildExtractManyPrompt(
  sourceName: string,
  url: string,
  markdown: string
): string {
  const text = markdown.trim()
  if (text === '') throw new EmptyPageError()

  return [
    `Quelle: ${sourceName}`,
    `URL: ${url}`,
    '',
    'Seiteninhalt (Markdown):',
    text.slice(0, MAX_MARKDOWN)
  ].join('\n')
}

export interface Extraction {
  isOffer: boolean
  title: string
  category: OfferCategory | null
  summary: string | null
  audience: string | null
  contact: string | null
  listedAt: string | null
  evergreen: boolean
}

/** One entry from a multi-offer page — always an offer, may carry its own link. */
export interface OfferExtraction {
  title: string
  category: OfferCategory | null
  summary: string | null
  audience: string | null
  contact: string | null
  listedAt: string | null
  evergreen: boolean
  link: string | null
}

const CATEGORIES: OfferCategory[] = ['sucht', 'bietet', 'verkauft']
const MAX_SUMMARY = 200
const MAX_TITLE = 255
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function optionalString(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed.slice(0, max)
}

function categoryOf(value: unknown): OfferCategory | null {
  return typeof value === 'string' &&
    CATEGORIES.includes(value as OfferCategory)
    ? (value as OfferCategory)
    : null
}

function isoDateOf(value: unknown): string | null {
  const raw = optionalString(value, 10)
  return raw !== null && ISO_DATE.test(raw) ? raw : null
}

/**
 * Validates the model answer before it becomes a row. The model is asked for this shape,
 * which is not the same as being given it — guard every field.
 */
export function parseExtraction(value: unknown): Extraction {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Claude-Antwort ist kein Objekt.')
  }

  const candidate = value as Record<string, unknown>

  return {
    isOffer: candidate['isOffer'] === true,
    title: optionalString(candidate['title'], MAX_TITLE) ?? '',
    category: categoryOf(candidate['category']),
    summary: optionalString(candidate['summary'], MAX_SUMMARY),
    audience: optionalString(candidate['audience'], 255),
    contact: optionalString(candidate['contact'], 255),
    listedAt: isoDateOf(candidate['listedAt']),
    evergreen: candidate['evergreen'] === true
  }
}

/**
 * Validates a multi-offer answer ({ offers: [...] }). Drops entries without a title, and
 * anything that is not an object. Never throws on a malformed list — returns what parses.
 */
export function parseExtractionList(value: unknown): OfferExtraction[] {
  const container = value as { offers?: unknown } | null
  const list = Array.isArray(value)
    ? value
    : Array.isArray(container?.offers)
      ? container.offers
      : []

  const offers: OfferExtraction[] = []
  for (const entry of list) {
    if (typeof entry !== 'object' || entry === null) continue
    const e = entry as Record<string, unknown>
    const title = optionalString(e['title'], MAX_TITLE)
    if (title === null) continue

    offers.push({
      title,
      category: categoryOf(e['category']),
      summary: optionalString(e['summary'], MAX_SUMMARY),
      audience: optionalString(e['audience'], 255),
      contact: optionalString(e['contact'], 255),
      listedAt: isoDateOf(e['listedAt']),
      evergreen: e['evergreen'] === true,
      link: optionalString(e['link'], 1024)
    })
  }
  return offers
}

/** The AI columns alone — for reclassifying an existing row (e.g. a manual entry). */
export interface ClassificationFields {
  ai_category: OfferCategory | null
  ai_summary: string | null
  ai_audience: string | null
  ai_evergreen: boolean
  ai_generated_at: string
}

/**
 * Maps an extraction onto the AI columns only, leaving source/contact/date untouched.
 * Used by the second pass to classify offers that were created without a scrape (manual
 * entries) from their existing text.
 */
export function classificationFields(
  extraction: Extraction,
  generatedAt: Date
): ClassificationFields {
  return {
    ai_category: extraction.category,
    ai_summary: extraction.summary,
    ai_audience: extraction.audience,
    ai_evergreen: extraction.evergreen,
    ai_generated_at: generatedAt.toISOString()
  }
}

/** The columns a discovered+extracted offer writes. */
export interface OfferFields {
  source: OfferSource
  source_id: string | null
  source_url: string
  title: string
  raw_text: string
  contact: string | null
  listed_at: string | null
  ai_category: OfferCategory | null
  ai_summary: string | null
  ai_audience: string | null
  ai_evergreen: boolean
  ai_generated_at: string
}

/**
 * Maps a validated extraction onto the collection's fields — one place, so nothing
 * downstream re-derives it. `raw_text` keeps a trimmed slice of the source Markdown so the
 * redaction can see the original wording next to the AI summary.
 *
 * Falls back to a generic title when the model returned none, so the required `title`
 * column is always satisfied.
 */
export function offerFields(
  candidate: {
    source: OfferSource
    sourceId: string | null
    sourceUrl: string
  },
  markdown: string,
  extraction: Extraction,
  generatedAt: Date
): OfferFields {
  return {
    source: candidate.source,
    source_id: candidate.sourceId,
    source_url: candidate.sourceUrl,
    title: extraction.title !== '' ? extraction.title : 'Ohne Titel',
    raw_text: markdown.trim().slice(0, MAX_MARKDOWN),
    contact: extraction.contact,
    listed_at: extraction.listedAt,
    ai_category: extraction.category,
    ai_summary: extraction.summary,
    ai_audience: extraction.audience,
    ai_evergreen: extraction.evergreen,
    ai_generated_at: generatedAt.toISOString()
  }
}
