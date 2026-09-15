import { evaluate, type CriteriaInput } from '../../endpoints/wohnungen-collect/criteria'

// Pure payload normalisation for the wohnungen collection: trim the text fields and, from
// the criteria inputs, compute `miete_pro_m2`, `ai_passt` and `ai_passt_grund` in one place
// (a rule, not Claude). On create the payload has everything; on update we only recompute
// when both rent and area are present, to avoid judging on a half-filled partial edit.

export interface WohnungPayload {
  titel?: string | null
  adresse?: string | null
  plattform?: string | null
  quartier?: string | null
  plz?: string | null
  zimmer?: number | null
  flaeche_m2?: number | null
  miete_chf?: number | null
  ai_moebliert?: boolean | null
  ai_untermiete?: boolean | null
  ai_befristet?: boolean | null
  ai_wg?: boolean | null
  miete_pro_m2?: number | null
  ai_passt?: boolean | null
  ai_passt_grund?: string | null
}

const TRIM_FIELDS = ['titel', 'adresse', 'plattform', 'quartier', 'plz'] as const

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}
function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}
function bool(v: unknown): boolean | null {
  return typeof v === 'boolean' ? v : null
}

/**
 * @param isCreate true for `.items.create` — then the criteria are always (re)computed.
 *   For updates they are recomputed only when rent and area are both in the payload.
 */
export function normalizeWohnungPayload(
  payload: WohnungPayload,
  isCreate: boolean
): WohnungPayload {
  const next: WohnungPayload = { ...payload }

  for (const f of TRIM_FIELDS) {
    const v = next[f]
    if (typeof v === 'string') next[f] = v.trim()
  }

  const has = (k: keyof WohnungPayload) =>
    Object.prototype.hasOwnProperty.call(payload, k)
  const recompute =
    isCreate || (has('miete_chf') && has('flaeche_m2'))

  if (recompute) {
    const input: CriteriaInput = {
      zimmer: num(payload.zimmer),
      flaeche_m2: num(payload.flaeche_m2),
      miete_chf: num(payload.miete_chf),
      plz: str(payload.plz),
      adresse: str(payload.adresse),
      ai_moebliert: bool(payload.ai_moebliert),
      ai_untermiete: bool(payload.ai_untermiete),
      ai_befristet: bool(payload.ai_befristet),
      ai_wg: bool(payload.ai_wg)
    }
    const r = evaluate(input)
    next.miete_pro_m2 = r.mieteProM2
    next.ai_passt = r.passt
    next.ai_passt_grund = r.grund
  }

  return next
}
