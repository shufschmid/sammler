import { describe, expect, it } from 'vitest'
import { normalizeWohnungPayload } from './normalize'

describe('normalizeWohnungPayload', () => {
  it('trims text fields', () => {
    const n = normalizeWohnungPayload({ titel: '  Loft  ', adresse: ' A 1 ' }, false)
    expect(n.titel).toBe('Loft')
    expect(n.adresse).toBe('A 1')
  })

  it('computes miete_pro_m2 and ai_passt on create', () => {
    const n = normalizeWohnungPayload(
      { miete_chf: 1600, flaeche_m2: 80, plz: '4057', adresse: 'A, 4057 Basel' },
      true
    )
    expect(n.miete_pro_m2).toBe(240)
    expect(n.ai_passt).toBe(true)
    expect(n.ai_passt_grund).toContain('240')
  })

  it('marks over-300 and wrong-type as not passing', () => {
    expect(normalizeWohnungPayload({ miete_chf: 2000, flaeche_m2: 70, plz: '4051' }, true).ai_passt).toBe(false)
    expect(normalizeWohnungPayload({ ai_wg: true, miete_chf: 800, flaeche_m2: 40, plz: '4051' }, true).ai_passt).toBe(false)
  })

  it('does not recompute on a partial update lacking rent/area', () => {
    const n = normalizeWohnungPayload({ quartier: 'Gundeli' }, false)
    expect('miete_pro_m2' in n).toBe(false)
    expect('ai_passt' in n).toBe(false)
  })

  it('recomputes on an update that carries both rent and area', () => {
    const n = normalizeWohnungPayload({ miete_chf: 1500, flaeche_m2: 90, plz: '4052' }, false)
    expect(n.miete_pro_m2).toBe(200)
    expect(n.ai_passt).toBe(true)
  })
})
