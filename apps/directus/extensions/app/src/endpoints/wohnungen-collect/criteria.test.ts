import { describe, expect, it } from 'vitest'
import { evaluate, mieteProM2, type CriteriaInput } from './criteria'

function w(partial: Partial<CriteriaInput>): CriteriaInput {
  return {
    zimmer: 3,
    flaeche_m2: 90,
    miete_chf: 1830,
    plz: '4052',
    adresse: 'Zürcherstrasse 35, 4052 Basel',
    ai_moebliert: false,
    ai_untermiete: false,
    ai_befristet: false,
    ai_wg: false,
    ...partial
  }
}

describe('mieteProM2 (annual rent per m², as the spreadsheet tracks it)', () => {
  it('is monthly × 12 / area, rounded to one decimal', () => {
    expect(mieteProM2(1830, 90)).toBe(244) // matches the CSV example
    expect(mieteProM2(1950, 88)).toBe(265.9)
  })
  it('is null without usable numbers', () => {
    expect(mieteProM2(null, 90)).toBeNull()
    expect(mieteProM2(1830, 0)).toBeNull()
  })
})

describe('evaluate', () => {
  it('passes a cheap Basel flat (<= 250)', () => {
    const r = evaluate(w({ miete_chf: 1600, flaeche_m2: 80 })) // 240
    expect(r.passt).toBe(true)
    expect(r.mieteProM2).toBe(240)
  })

  it('passes but flags the 250–300 borderline band', () => {
    const r = evaluate(w({ miete_chf: 1618, flaeche_m2: 72 })) // 269.7
    expect(r.passt).toBe(true)
    expect(r.grund).toContain('grenzwertig')
  })

  it('fails above 300', () => {
    const r = evaluate(w({ miete_chf: 2000, flaeche_m2: 70 })) // 342.9
    expect(r.passt).toBe(false)
    expect(r.grund).toContain('ueber 300')
  })

  it('fails furnished / sublet / temporary / WG', () => {
    expect(evaluate(w({ ai_moebliert: true })).grund).toBe('moebliert')
    expect(evaluate(w({ ai_untermiete: true })).grund).toBe('Untermiete')
    expect(evaluate(w({ ai_befristet: true })).grund).toBe('befristet')
    expect(evaluate(w({ ai_wg: true })).grund).toBe('WG-Zimmer')
  })

  it('requires the city of Basel (PLZ 40xx)', () => {
    expect(evaluate(w({ plz: '4127' })).passt).toBe(false) // Birsfelden
    expect(evaluate(w({ plz: '4125' })).passt).toBe(false) // Riehen
    expect(evaluate(w({ plz: '4051' })).passt).toBe(true)
  })

  it('passes but flags when price is unknown', () => {
    const r = evaluate(w({ miete_chf: null }))
    expect(r.passt).toBe(true)
    expect(r.grund).toContain('unbekannt')
  })
})
