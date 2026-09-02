import { describe, expect, it } from 'vitest'
import { detailUrl, discover } from './fraufasnacht'

describe('fraufasnacht discover', () => {
  it('extracts inserat ids from listing markdown (encoded brackets)', () => {
    const markdown = [
      '[Verkaufe "Skeletti"](https://fraufasnacht.ch/marktplatz/detailansicht/?no_cache=1&tx_fraufasnacht_inserate%5Binserate%5D=27&tx_fraufasnacht_inserate%5Baction%5D=show)',
      '[Kaefer-Goschdyym M](https://fraufasnacht.ch/marktplatz/detailansicht/?tx_fraufasnacht_inserate%5Binserate%5D=157&x=1)'
    ].join('\n')

    const candidates = discover(markdown)

    expect(candidates.map((c) => c.sourceId)).toEqual(['27', '157'])
    expect(candidates[0]).toMatchObject({
      source: 'fraufasnacht',
      needsPlaywright: false,
      sourceUrl: detailUrl('27')
    })
  })

  it('handles decoded brackets too', () => {
    const markdown =
      '[X](https://fraufasnacht.ch/marktplatz/detailansicht/?tx_fraufasnacht_inserate[inserate]=333&a=b)'
    expect(discover(markdown).map((c) => c.sourceId)).toEqual(['333'])
  })

  it('deduplicates repeated ids within a page (image + title link)', () => {
    const markdown = [
      '[img](https://fraufasnacht.ch/marktplatz/detailansicht/?tx_fraufasnacht_inserate%5Binserate%5D=41)',
      '[title](https://fraufasnacht.ch/marktplatz/detailansicht/?tx_fraufasnacht_inserate%5Binserate%5D=41)'
    ].join('\n')

    expect(discover(markdown)).toHaveLength(1)
  })

  it('returns nothing for markdown without inserate links', () => {
    expect(discover('# Marktplatz\n\nKeine Inserate.')).toEqual([])
  })

  it('builds a canonical cHash-free detail url', () => {
    expect(detailUrl('157')).toContain('[inserate]=157')
    expect(detailUrl('157')).not.toContain('cHash')
  })
})
