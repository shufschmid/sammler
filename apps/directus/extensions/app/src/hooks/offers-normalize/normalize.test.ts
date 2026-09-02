import { describe, expect, it } from 'vitest'
import { normalizeOfferPayload } from './normalize'

describe('normalizeOfferPayload', () => {
  it('trims title and contact', () => {
    const next = normalizeOfferPayload({
      title: '  Larve  ',
      contact: '  a@b.ch '
    })
    expect(next.title).toBe('Larve')
    expect(next.contact).toBe('a@b.ch')
  })

  it('clears the classification when the title or text changes', () => {
    const next = normalizeOfferPayload({ raw_text: 'neuer Text' })
    expect(next.ai_category).toBeNull()
    expect(next.ai_summary).toBeNull()
    expect(next.ai_audience).toBeNull()
    expect(next.ai_generated_at).toBeNull()
  })

  it('leaves the classification alone when the write is the classification itself', () => {
    const next = normalizeOfferPayload({
      ai_category: 'sucht',
      ai_summary: 'Kurz.',
      ai_audience: 'Cliquen',
      ai_generated_at: '2026-09-02T06:00:00Z'
    })

    expect(next.ai_summary).toBe('Kurz.')
    expect(next.ai_category).toBe('sucht')
  })

  it('does not clear the classification on an unrelated write (status change)', () => {
    expect(normalizeOfferPayload({ status: 'accepted' })).toEqual({
      status: 'accepted'
    })
  })

  it('leaves the incoming payload untouched', () => {
    const payload = { raw_text: 'x' }
    normalizeOfferPayload(payload)
    expect(payload).toEqual({ raw_text: 'x' })
  })
})
