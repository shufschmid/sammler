// Pure criteria evaluation for a collected apartment (from the redaction's rules in the
// process PDF). No I/O — see criteria.test.ts. Used by the hook to fill `ai_passt` /
// `ai_passt_grund` and by the frontend filter. Never hard-drops a listing: a failing one
// is kept and marked, the redaction decides via status.
//
// Rules: no furnished / sublet / temporary / WG-room; only the city of Basel (PLZ 40xx);
// price/m² per year ≤ 250 (that is monthly rent × 12 / m², exactly the "Miete / m2" column
// in the redaction's spreadsheet), soft up to 300, never above 300.

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
const MAX = 300 // "Allermaximal"

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

/** True for a City-of-Basel address: PLZ 40xx, else an address mentioning Basel. */
function istStadtBasel(plz: string | null, adresse: string | null): boolean {
  const p = (plz ?? '').trim()
  if (/^40\d\d$/.test(p)) return true
  if (p !== '') return false // a PLZ outside 40xx is not the city
  return (adresse ?? '').toLowerCase().includes('basel')
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
    return { passt: true, mieteProM2: null, grund: 'Preis/m2 unbekannt — bitte pruefen' }

  if (preis > MAX)
    return { passt: false, mieteProM2: preis, grund: `Miete/m2/Jahr ${preis} ueber ${MAX}` }

  const grund =
    preis > RICHTWERT
      ? `Miete/m2/Jahr ${preis} (grenzwertig, ueber ${RICHTWERT})`
      : `Miete/m2/Jahr ${preis}`
  return { passt: true, mieteProM2: preis, grund }
}
