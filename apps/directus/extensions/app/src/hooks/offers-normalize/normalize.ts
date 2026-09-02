// Pure payload normalisation for the offers collection.

export interface OfferPayload {
  title?: string | null
  raw_text?: string | null
  contact?: string | null
  ai_category?: string | null
  ai_summary?: string | null
  ai_audience?: string | null
  ai_generated_at?: string | null
  status?: string | null
}

const AI_FIELDS = [
  'ai_category',
  'ai_summary',
  'ai_audience',
  'ai_generated_at'
] as const

/**
 * Trims the human-entered fields and, when the source text changes, clears every AI
 * field so a stale classification can never outlive the text it describes.
 *
 * Anything Claude derived from a record is a cache. Invalidate it in a hook (one place,
 * every write path) rather than in each endpoint or operation that edits data. The
 * collect operation writes only the `ai_*` fields when it classifies, so its own
 * update passes through untouched.
 */
export function normalizeOfferPayload(payload: OfferPayload): OfferPayload {
  const next: OfferPayload = { ...payload }

  if (typeof next.title === 'string') next.title = next.title.trim()
  if (typeof next.contact === 'string') next.contact = next.contact.trim()

  const textChanged =
    Object.prototype.hasOwnProperty.call(payload, 'title') ||
    Object.prototype.hasOwnProperty.call(payload, 'raw_text')
  const aiWrittenExplicitly = AI_FIELDS.some((field) =>
    Object.prototype.hasOwnProperty.call(payload, field)
  )

  if (textChanged && !aiWrittenExplicitly) {
    next.ai_category = null
    next.ai_summary = null
    next.ai_audience = null
    next.ai_generated_at = null
  }

  return next
}
