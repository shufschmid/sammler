import { describe, expect, it } from 'vitest'
import {
  buildExtractManyPrompt,
  EmptyPageError,
  parseWohnung,
  parseWohnungList,
  wohnungFields,
  type WohnungExtraction
} from './extract'

describe('parseWohnungList', () => {
  it('reads the array, coerces numbers, drops entries without a title', () => {
    const list = parseWohnungList({
      wohnungen: [
        {
          titel: '3-Zimmer-Wohnung im St. Johann',
          zimmer: '3',
          flaeche_m2: '80 m²',
          miete_chf: "1'620",
          adresse: 'Elsässerstrasse 117',
          plz: '4056',
          quartier: 'St. Johann',
          genossenschaft: false,
          moebliert: false,
          untermiete: false,
          befristet: false,
          wg: false,
          link: 'https://x.test/1'
        },
        { zimmer: 2 }, // no title -> dropped
        'garbage'
      ]
    })
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      titel: '3-Zimmer-Wohnung im St. Johann',
      zimmer: 3,
      flaeche_m2: 80,
      miete_chf: 1620,
      plz: '4056',
      link: 'https://x.test/1'
    })
  })

  it('tolerates a bare array and a missing field', () => {
    expect(parseWohnungList([{ titel: 'A' }])).toHaveLength(1)
    expect(parseWohnungList({})).toEqual([])
    expect(parseWohnungList(null)).toEqual([])
  })
})

describe('parseWohnung (single)', () => {
  it('parses one listing and coerces 2.5 rooms', () => {
    const w = parseWohnung({ titel: 'Loft', zimmer: '2.5', flaeche_m2: 70, miete_chf: 1340 })
    expect(w?.zimmer).toBe(2.5)
    expect(w?.flaeche_m2).toBe(70)
  })
  it('is null without a title', () => {
    expect(parseWohnung({ zimmer: 3 })).toBeNull()
  })
})

describe('buildExtractManyPrompt', () => {
  it('includes source, url, markdown and throws on empty', () => {
    const p = buildExtractManyPrompt('Gewona', 'https://q.test', '# Freie Wohnungen')
    expect(p).toContain('Gewona')
    expect(p).toContain('https://q.test')
    expect(() => buildExtractManyPrompt('x', 'y', '  ')).toThrow(EmptyPageError)
  })
})

describe('wohnungFields', () => {
  const ex: WohnungExtraction = {
    titel: 'T',
    zimmer: 3,
    flaeche_m2: 80,
    miete_chf: 1600,
    adresse: 'A 1',
    plz: '4057',
    quartier: 'Matthäus',
    genossenschaft: true,
    moebliert: false,
    untermiete: false,
    befristet: false,
    wg: false,
    link: 'https://x.test'
  }
  it('maps onto the columns; miete_pro_m2/ai_passt are left to the hook', () => {
    const f = wohnungFields(
      { source: 'genossenschaft', sourceId: 'abc', sourceUrl: 'https://x.test', plattform: 'Gewona' },
      ex,
      new Date('2026-09-15T06:00:00Z')
    )
    expect(f).toMatchObject({
      source: 'genossenschaft',
      source_url: 'https://x.test',
      plattform: 'Gewona',
      titel: 'T',
      zimmer: 3,
      flaeche_m2: 80,
      miete_chf: 1600,
      plz: '4057',
      ai_genossenschaft: true,
      ai_generated_at: '2026-09-15T06:00:00.000Z'
    })
    expect('miete_pro_m2' in f).toBe(false)
    expect('ai_passt' in f).toBe(false)
  })
})
