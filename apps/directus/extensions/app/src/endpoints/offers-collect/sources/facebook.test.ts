import { describe, expect, it } from 'vitest'
import { discover } from './facebook'

describe('facebook discover', () => {
  it('extracts post permalinks when the page surfaces them', () => {
    const markdown = [
      '[Post](https://www.facebook.com/groups/457616777678107/posts/25564763189870119/)',
      '[Permalink](https://www.facebook.com/permalink/799391939087117/)'
    ].join('\n')

    const candidates = discover(markdown)

    expect(candidates.map((c) => c.sourceId)).toEqual([
      '25564763189870119',
      '799391939087117'
    ])
    expect(candidates[0]).toMatchObject({
      source: 'facebook',
      needsPlaywright: true
    })
  })

  it('returns nothing behind a login wall (no post links) — not an error', () => {
    const markdown =
      '# Anmelden bei Facebook\n\n[Login](https://www.facebook.com/login/)'
    expect(discover(markdown)).toEqual([])
  })

  it('deduplicates a post id seen twice', () => {
    const markdown = [
      '[a](https://www.facebook.com/groups/457616777678107/posts/111/)',
      '[b](https://www.facebook.com/groups/457616777678107/posts/111/)'
    ].join('\n')

    expect(discover(markdown)).toHaveLength(1)
  })
})
