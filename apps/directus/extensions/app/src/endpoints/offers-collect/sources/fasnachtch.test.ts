import { describe, expect, it } from 'vitest'
import { discover, looksLikeOffer } from './fasnachtch'

describe('looksLikeOffer', () => {
  it('accepts headlines that read like offers or requests', () => {
    expect(looksLikeOffer('Entwuerfe fuer die Plakette 2027 gesucht')).toBe(
      true
    )
    expect(looksLikeOffer('Unbekannte Trommelmaersche gesucht')).toBe(true)
    expect(looksLikeOffer('Fasnachtswagen zu verkaufen')).toBe(true)
  })

  it('rejects plain news headlines', () => {
    expect(looksLikeOffer('Grossartige Tattoo Parade 2026')).toBe(false)
    expect(looksLikeOffer('Neuer Obmann der Wage-IG')).toBe(false)
  })
})

describe('fasnachtch discover', () => {
  it('keeps only offer-like article links on the fasnacht.ch domain', () => {
    const markdown = [
      '[Entwuerfe fuer die Plakette 2027 gesucht](https://fasnacht.ch/entwuerfe-fuer-die-plakette-2027-gesucht/)',
      '[Grossartige Tattoo Parade 2026](https://fasnacht.ch/grossartige-tattoo-parade-2026/)',
      '[Helfer gesucht](https://example.com/anderswo/)'
    ].join('\n')

    const candidates = discover(markdown)

    expect(candidates).toHaveLength(1)
    expect(candidates[0]).toMatchObject({
      source: 'fasnacht_ch',
      sourceId: 'entwuerfe-fuer-die-plakette-2027-gesucht',
      needsPlaywright: false
    })
  })

  it('skips category and tag index pages', () => {
    const markdown = '[Alles gesucht](https://fasnacht.ch/category/gesucht/)'
    expect(discover(markdown)).toEqual([])
  })
})
