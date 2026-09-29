import { describe, expect, it } from 'vitest'
import { recompute, type WohnungRow } from './reevaluate'

function row(partial: Partial<WohnungRow>): WohnungRow {
  return {
    id: 'a1',
    zimmer: 3,
    flaeche_m2: 80,
    miete_chf: 1600,
    plz: '4057',
    adresse: 'Amerbachstrasse 1, 4057 Basel',
    ai_moebliert: false,
    ai_untermiete: false,
    ai_befristet: false,
    ai_wg: false,
    miete_pro_m2: 240,
    ai_passt: true,
    ai_passt_grund: 'Miete/m2/Jahr 240',
    ...partial
  }
}

describe('recompute', () => {
  it('returns null when the stored verdict already matches', () => {
    expect(recompute(row({}))).toBeNull()
  })

  it('fixes a row that was rejected under the old, stricter rule', () => {
    // "Am Ring" without PLZ used to fail as "nicht Stadt Basel".
    const r = recompute(
      row({
        plz: null,
        adresse: 'Am Ring',
        ai_passt: false,
        ai_passt_grund: 'nicht Stadt Basel'
      })
    )
    expect(r).not.toBeNull()
    expect(r?.ai_passt).toBe(true)
    expect(r?.ai_passt_grund).not.toContain('nicht Stadt Basel')
  })

  it('fixes a row that the raised price cap now lets through', () => {
    // 2000 / 70 m² = 342.9 — over the old 300 cap, under the new 350 one.
    const r = recompute(
      row({
        miete_chf: 2000,
        flaeche_m2: 70,
        miete_pro_m2: 342.9,
        ai_passt: false,
        ai_passt_grund: 'Miete/m2/Jahr 342.9 ueber 300'
      })
    )
    expect(r?.ai_passt).toBe(true)
  })

  it('recomputes miete_pro_m2 when it was missing', () => {
    const r = recompute(row({ miete_pro_m2: null }))
    expect(r?.miete_pro_m2).toBe(240)
  })

  it('still rejects what the rules reject', () => {
    const r = recompute(row({ ai_wg: true }))
    expect(r?.ai_passt).toBe(false)
    expect(r?.ai_passt_grund).toBe('WG-Zimmer')
  })
})
