// Pure criteria evaluation for a collected apartment (from the redaction's rules in the
// process PDF). No I/O — see criteria.test.ts. Used by the hook to fill `ai_passt` /
// `ai_passt_grund` and by the frontend filter. Never hard-drops a listing: a failing one
// is kept and marked, the redaction decides via status.
//
// Rules: no furnished / sublet / temporary / WG-room; the city of Basel (PLZ 40xx, and
// without a PLZ only rejected when another municipality is named — see istStadtBasel);
// price/m² per year ≤ 250 ideal (that is monthly rent × 12 / m², exactly the "Miete / m2"
// column in the redaction's spreadsheet), 250–350 borderline but still passes, above 350
// fails (≈ 29 CHF/m² per month).

export interface CriteriaInput {
  zimmer: number | null
  flaeche_m2: number | null
  miete_chf: number | null
  plz: string | null
  adresse: string | null
  ai_moebliert: boolean | null
  ai_untermiete: boolean | null
  ai_befristet: boolean | null
  ai_wg: boolean | null
}

export interface CriteriaResult {
  passt: boolean
  mieteProM2: number | null
  grund: string
}

const RICHTWERT = 250 // ideal
const MAX = 350 // "Allermaximal" (≈ 29 CHF/m² pro Monat)

/**
 * Annual rent per m² (monthly rent × 12 / m²), rounded to one decimal — the same figure
 * the redaction tracks as "Miete / m2". Null when rent or area is missing.
 */
export function mieteProM2(
  miete: number | null,
  flaeche: number | null
): number | null {
  if (miete === null || flaeche === null || flaeche <= 0) return null
  return Math.round(((miete * 12) / flaeche) * 10) / 10
}

/** Lowercase + umlauts folded, so "Münchenstein" and "Muenchenstein" both match. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/é/g, 'e')
}

/**
 * Municipalities around Basel that are clearly NOT the city. Used only to *reject* — a
 * name that is not on this list never rejects, so Basel quarters ("Am Ring", "Gundeli",
 * …) and bare street names pass.
 */
const ANDERE_GEMEINDEN = [
  'riehen',
  'bettingen',
  'binningen',
  'bottmingen',
  'allschwil',
  'schonenbuch',
  'schoenenbuch',
  'oberwil',
  'therwil',
  'biel-benken',
  'ettingen',
  'reinach',
  'aesch',
  'pfeffingen',
  'munchenstein',
  'muenchenstein',
  'muttenz',
  'birsfelden',
  'arlesheim',
  'dornach',
  'pratteln',
  'augst',
  'kaiseraugst',
  'liestal',
  'fullinsdorf',
  'frenkendorf',
  'rheinfelden',
  'weil am rhein',
  'lorrach',
  'loerrach',
  'saint-louis',
  'huningue',
  'hegenheim',
  'village-neuf'
]

/**
 * True for a City-of-Basel address. Deliberately lenient: a PLZ is authoritative (40xx =
 * city), but without one we only reject when another municipality is named. Anything else
 * — a Basel quarter like "Am Ring", a bare street, no address at all — passes, and the
 * redaction decides. A false positive costs one glance; a false negative hides a flat.
 */
function istStadtBasel(plz: string | null, adresse: string | null): boolean {
  const code = (plz ?? '').match(/\b(\d{4})\b/)?.[1] ?? null
  if (code !== null) return /^40\d\d$/.test(code)

  const ort = normalize(`${plz ?? ''} ${adresse ?? ''}`)
  if (ANDERE_GEMEINDEN.some((g) => ort.includes(g))) return false
  return true
}

export function evaluate(w: CriteriaInput): CriteriaResult {
  const preis = mieteProM2(w.miete_chf, w.flaeche_m2)

  if (w.ai_moebliert === true)
    return { passt: false, mieteProM2: preis, grund: 'moebliert' }
  if (w.ai_untermiete === true)
    return { passt: false, mieteProM2: preis, grund: 'Untermiete' }
  if (w.ai_befristet === true)
    return { passt: false, mieteProM2: preis, grund: 'befristet' }
  if (w.ai_wg === true)
    return { passt: false, mieteProM2: preis, grund: 'WG-Zimmer' }

  if (!istStadtBasel(w.plz, w.adresse))
    return { passt: false, mieteProM2: preis, grund: 'nicht Stadt Basel' }

  if (preis === null)
    return {
      passt: true,
      mieteProM2: null,
      grund: 'Preis/m2 unbekannt — bitte pruefen'
    }

  if (preis > MAX)
    return {
      passt: false,
      mieteProM2: preis,
      grund: `Miete/m2/Jahr ${preis} ueber ${MAX}`
    }

  const grund =
    preis > RICHTWERT
      ? `Miete/m2/Jahr ${preis} (grenzwertig, ueber ${RICHTWERT})`
      : `Miete/m2/Jahr ${preis}`
  return { passt: true, mieteProM2: preis, grund }
}
