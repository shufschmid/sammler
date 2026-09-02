import { describe, expect, it } from 'vitest'
import { discover } from './unimarkt'

describe('unimarkt discover', () => {
  it('extracts /post/<slug> links from rendered search markdown', () => {
    const markdown = [
      '[Laternentraeger 2026 gesucht](https://markt.unibas.ch/post/laternentrager-fasnacht-2026-gesucht-4rhmj4am3q)',
      '[Serviceaushilfe](/post/serviceaushilfe-zur-fasnacht-1nin7w0qbv)'
    ].join('\n')

    const candidates = discover(markdown)

    expect(candidates.map((c) => c.sourceId)).toEqual([
      'laternentrager-fasnacht-2026-gesucht-4rhmj4am3q',
      'serviceaushilfe-zur-fasnacht-1nin7w0qbv'
    ])
    expect(candidates[0]).toMatchObject({
      source: 'unimarkt',
      needsPlaywright: true,
      sourceUrl:
        'https://markt.unibas.ch/post/laternentrager-fasnacht-2026-gesucht-4rhmj4am3q'
    })
  })

  it('ignores non-post links (pages, articles, categories)', () => {
    const markdown = [
      '[Regeln](https://markt.unibas.ch/pages/rules)',
      '[Home](https://markt.unibas.ch/)',
      '[Artikel](https://markt.unibas.ch/article/fasnachts-helge)'
    ].join('\n')

    expect(discover(markdown)).toEqual([])
  })

  it('deduplicates a slug seen twice', () => {
    const markdown = [
      '[a](/post/laternen-gesucht-abc123)',
      '[a again](/post/laternen-gesucht-abc123)'
    ].join('\n')

    expect(discover(markdown)).toHaveLength(1)
  })
})
