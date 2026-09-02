import { describe, expect, it } from 'vitest'
import type { Candidate } from './sources'
import { offerKey, selectNewCandidates, selectUnclassified } from './collect'

function candidate(partial: Partial<Candidate>): Candidate {
  return {
    source: 'fraufasnacht',
    sourceId: '1',
    sourceUrl: 'https://x.test/1',
    needsPlaywright: false,
    ...partial
  }
}

describe('offerKey', () => {
  it('combines source and id', () => {
    expect(offerKey('fraufasnacht', '27')).toBe('fraufasnacht:27')
  })
  it('is null without an id', () => {
    expect(offerKey('manual', null)).toBeNull()
    expect(offerKey('manual', '')).toBeNull()
  })
})

describe('selectNewCandidates', () => {
  it('drops candidates known by url or by source id', () => {
    const candidates = [
      candidate({ sourceId: '1', sourceUrl: 'https://x.test/1' }),
      candidate({ sourceId: '2', sourceUrl: 'https://x.test/2' }),
      candidate({ sourceId: '3', sourceUrl: 'https://x.test/3' })
    ]

    const result = selectNewCandidates(
      candidates,
      new Set(['https://x.test/2']),
      new Set(['fraufasnacht:3']),
      10
    )

    expect(result.map((c) => c.sourceId)).toEqual(['1'])
  })

  it('deduplicates within the batch', () => {
    const dupUrl = [
      candidate({ sourceId: '1', sourceUrl: 'https://x.test/1' }),
      candidate({ sourceId: '9', sourceUrl: 'https://x.test/1' })
    ]
    expect(selectNewCandidates(dupUrl, new Set(), new Set(), 10)).toHaveLength(
      1
    )
  })

  it('caps at the limit', () => {
    const many = Array.from({ length: 5 }, (_, i) =>
      candidate({ sourceId: String(i), sourceUrl: `https://x.test/${i}` })
    )
    expect(selectNewCandidates(many, new Set(), new Set(), 3)).toHaveLength(3)
  })

  it('falls back to a safe limit for a bad value', () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      candidate({ sourceId: String(i), sourceUrl: `https://x.test/${i}` })
    )
    expect(selectNewCandidates(many, new Set(), new Set(), 0)).toHaveLength(20)
  })
})

describe('selectUnclassified', () => {
  const base = {
    title: 'T',
    raw_text: 'text',
    ai_generated_at: null,
    status: 'new'
  }

  it('picks offers without a classification that have text', () => {
    const offers = [
      { id: 'a', ...base },
      { id: 'b', ...base, ai_generated_at: '2026-01-01T00:00:00Z' },
      { id: 'c', ...base, status: 'dismissed' },
      { id: 'd', ...base, title: '', raw_text: '   ' }
    ]

    expect(selectUnclassified(offers, 10).map((o) => o.id)).toEqual(['a'])
  })

  it('caps at the limit', () => {
    const offers = Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      ...base
    }))
    expect(selectUnclassified(offers, 2)).toHaveLength(2)
  })
})
