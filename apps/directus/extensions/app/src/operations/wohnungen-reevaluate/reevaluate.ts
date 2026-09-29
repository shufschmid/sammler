import {
  evaluate,
  type CriteriaInput
} from '../../endpoints/wohnungen-collect/criteria'

// Pure re-evaluation of an already stored apartment. The hook only computes the criteria
// when a row is written, so changing a threshold in criteria.ts leaves the existing rows
// on their old verdict — this is what brings them up to date. No I/O; see reevaluate.test.ts.

export interface WohnungRow extends CriteriaInput {
  id: string
  miete_pro_m2: number | null
  ai_passt: boolean | null
  ai_passt_grund: string | null
}

export interface Recomputed {
  miete_pro_m2: number | null
  ai_passt: boolean
  ai_passt_grund: string
}

/** The criteria fields for one row — or null when they already match and nothing needs writing. */
export function recompute(row: WohnungRow): Recomputed | null {
  const r = evaluate(row)
  if (
    row.miete_pro_m2 === r.mieteProM2 &&
    row.ai_passt === r.passt &&
    row.ai_passt_grund === r.grund
  ) {
    return null
  }
  return {
    miete_pro_m2: r.mieteProM2,
    ai_passt: r.passt,
    ai_passt_grund: r.grund
  }
}

/** The columns the operation needs to read to re-evaluate a row. */
export const REEVALUATE_FIELDS = [
  'id',
  'zimmer',
  'flaeche_m2',
  'miete_chf',
  'plz',
  'adresse',
  'ai_moebliert',
  'ai_untermiete',
  'ai_befristet',
  'ai_wg',
  'miete_pro_m2',
  'ai_passt',
  'ai_passt_grund'
]
