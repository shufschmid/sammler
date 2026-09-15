import type { WohnungSource } from '../../types/schema'

// Pure prompt building and answer validation for turning a scraped page (Markdown) into
// apartment listings. No network here — see extract.test.ts. Two shapes: `many` (a
// source's list page → several flats) and `one` (a single listing detail page, for the
// "Inserat per Link erfassen" endpoint). Both extract the fields the briefing box needs
// (Adresse, Quartier, Zimmer, m², Miete) plus the criteria flags.

const FIELD_RULES = [
  'Nimm nur Miet-Wohnungen in oder um Basel auf (keine Kaufobjekte, keine Gewerbe, keine Parkplaetze).',
  'zimmer: Zimmerzahl als Zahl (z. B. 2.5), sonst null.',
  'flaeche_m2: Wohnflaeche in Quadratmetern als ganze Zahl, sonst null.',
  'miete_chf: Monatsmiete in Schweizer Franken als ganze Zahl (ohne Tausender-Trennzeichen), sonst null. Wenn "warm/brutto" angegeben, nimm diese.',
  'adresse: Strasse und Hausnummer, sonst null. plz: 4-stellige Postleitzahl, sonst null. quartier: Basler Quartier, falls genannt, sonst null.',
  'titel: kurze Bezeichnung (z. B. "3-Zimmer-Wohnung im St. Johann").',
  'genossenschaft: true, wenn die Wohnung von einer Wohngenossenschaft/Stiftung stammt.',
  'moebliert/untermiete/befristet/wg: true, wenn moebliert bzw. Untermiete bzw. befristet/temporaer bzw. WG-Zimmer.',
  'link: die URL, die zu genau dieser Wohnung gehoert, falls im Markdown vorhanden, sonst null.',
  'Erfinde nichts, was nicht auf der Seite steht.'
]

export const EXTRACT_MANY_SYSTEM_PROMPT = [
  'Du extrahierst freie Miet-Wohnungen aus einer Seite (Markdown) fuer die Rubrik "Guenstige Wohnungen in Basel".',
  'Gib genau ein JSON-Objekt {"wohnungen": [...]} zurueck.',
  'Jeder Eintrag: {"titel": string, "zimmer": number|null, "flaeche_m2": number|null, "miete_chf": number|null, "adresse": string|null, "plz": string|null, "quartier": string|null, "genossenschaft": boolean, "moebliert": boolean, "untermiete": boolean, "befristet": boolean, "wg": boolean, "link": string|null}.',
  'Gibt es keine freien Wohnungen, ist "wohnungen" ein leeres Array.',
  ...FIELD_RULES
].join('\n')

export const EXTRACT_ONE_SYSTEM_PROMPT = [
  'Du extrahierst die Eckdaten EINER Miet-Wohnung aus der Detailseite eines Immobilien-Inserats (Markdown).',
  'Gib genau ein JSON-Objekt mit den Feldern zurueck:',
  '{"titel": string, "zimmer": number|null, "flaeche_m2": number|null, "miete_chf": number|null, "adresse": string|null, "plz": string|null, "quartier": string|null, "genossenschaft": boolean, "moebliert": boolean, "untermiete": boolean, "befristet": boolean, "wg": boolean}.',
  ...FIELD_RULES.filter((r) => !r.startsWith('link'))
].join('\n')

export class EmptyPageError extends Error {
  constructor() {
    super('Die Seite enthaelt keinen auswertbaren Text.')
    this.name = 'EmptyPageError'
  }
}

const MAX_MARKDOWN = 12000

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

export function buildExtractOnePrompt(url: string, markdown: string): string {
  const text = markdown.trim()
  if (text === '') throw new EmptyPageError()
  return [
    `URL: ${url}`,
    '',
    'Inserat (Markdown):',
    text.slice(0, MAX_MARKDOWN)
  ].join('\n')
}

/** Newsletter/reader mail → several flats. Same answer shape as the many prompt. */
export function buildExtractMailPrompt(
  subject: string,
  from: string,
  body: string
): string {
  const text = body.trim()
  if (text === '') throw new EmptyPageError()
  return [
    `Absender: ${from}`,
    `Betreff: ${subject}`,
    '',
    'Nachricht (Text):',
    text.slice(0, MAX_MARKDOWN)
  ].join('\n')
}

export interface WohnungExtraction {
  titel: string
  zimmer: number | null
  flaeche_m2: number | null
  miete_chf: number | null
  adresse: string | null
  plz: string | null
  quartier: string | null
  genossenschaft: boolean
  moebliert: boolean
  untermiete: boolean
  befristet: boolean
  wg: boolean
  link: string | null
}

function optionalString(value: unknown, max: number): string | null {
  if (typeof value === 'number') value = String(value)
  if (typeof value !== 'string') return null
  const t = value.trim()
  return t === '' ? null : t.slice(0, max)
}

/** A float from a number or a string like "2.5" / "2,5 Zimmer". */
function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const m = value.replace(',', '.').match(/-?\d+(\.\d+)?/)
  return m ? Number(m[0]) : null
}

/** An integer from a number or a string like "1'830" / "80 m²". */
function toInt(value: unknown): number | null {
  if (typeof value === 'number')
    return Number.isFinite(value) ? Math.round(value) : null
  if (typeof value !== 'string') return null
  const digits = value.replace(/[^\d]/g, '')
  return digits === '' ? null : parseInt(digits, 10)
}

function toBool(value: unknown): boolean {
  return value === true
}

function parseOne(entry: unknown): WohnungExtraction | null {
  if (typeof entry !== 'object' || entry === null) return null
  const e = entry as Record<string, unknown>
  const titel = optionalString(e['titel'], 255)
  if (titel === null) return null
  return {
    titel,
    zimmer: toNumber(e['zimmer']),
    flaeche_m2: toInt(e['flaeche_m2']),
    miete_chf: toInt(e['miete_chf']),
    adresse: optionalString(e['adresse'], 255),
    plz: optionalString(e['plz'], 16),
    quartier: optionalString(e['quartier'], 255),
    genossenschaft: toBool(e['genossenschaft']),
    moebliert: toBool(e['moebliert']),
    untermiete: toBool(e['untermiete']),
    befristet: toBool(e['befristet']),
    wg: toBool(e['wg']),
    link: optionalString(e['link'], 1024)
  }
}

/** Validates a multi answer ({ wohnungen: [...] }). Drops entries without a title. */
export function parseWohnungList(value: unknown): WohnungExtraction[] {
  const container = value as { wohnungen?: unknown } | null
  const list = Array.isArray(value)
    ? value
    : Array.isArray(container?.wohnungen)
      ? container.wohnungen
      : []
  const out: WohnungExtraction[] = []
  for (const entry of list) {
    const w = parseOne(entry)
    if (w !== null) out.push(w)
  }
  return out
}

/** Validates a single-listing answer; null when unusable (no title). */
export function parseWohnung(value: unknown): WohnungExtraction | null {
  return parseOne(value)
}

/** The columns a collected apartment writes (miete_pro_m2 / ai_passt are set by the hook). */
export interface WohnungFields {
  source: WohnungSource
  source_id: string | null
  source_url: string
  plattform: string
  titel: string
  beschreibung: string | null
  zimmer: number | null
  flaeche_m2: number | null
  miete_chf: number | null
  adresse: string | null
  plz: string | null
  quartier: string | null
  ai_genossenschaft: boolean
  ai_moebliert: boolean
  ai_untermiete: boolean
  ai_befristet: boolean
  ai_wg: boolean
  ai_generated_at: string
}

export function wohnungFields(
  meta: {
    source: WohnungSource
    sourceId: string | null
    sourceUrl: string
    plattform: string
  },
  w: WohnungExtraction,
  generatedAt: Date
): WohnungFields {
  return {
    source: meta.source,
    source_id: meta.sourceId,
    source_url: meta.sourceUrl,
    plattform: meta.plattform,
    titel: w.titel,
    beschreibung: null,
    zimmer: w.zimmer,
    flaeche_m2: w.flaeche_m2,
    miete_chf: w.miete_chf,
    adresse: w.adresse,
    plz: w.plz,
    quartier: w.quartier,
    ai_genossenschaft: w.genossenschaft,
    ai_moebliert: w.moebliert,
    ai_untermiete: w.untermiete,
    ai_befristet: w.befristet,
    ai_wg: w.wg,
    ai_generated_at: generatedAt.toISOString()
  }
}
