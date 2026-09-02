import type { Candidate } from './sources'

// Pure selection logic for the collect operation: which discovered candidates are new
// and worth scraping. Kept out of api.ts so the dedup rule is testable without a
// database or a network call.

/** Composite key for the (source, source_id) pair — the per-source identity. */
export function offerKey(
  source: string,
  sourceId: string | null
): string | null {
  return sourceId === null || sourceId === '' ? null : `${source}:${sourceId}`
}

/**
 * A URL-safe slug of an offer title, used to give custom-source offers a stable id and a
 * per-offer anchor URL when the page itself lists several. Bounded so a long title cannot
 * blow the key length.
 */
export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'inserat'
  )
}

/**
 * Drops candidates already stored (by URL or by source identity) and any duplicate
 * within this batch, then caps the result at `limit`. Bounding here is what keeps a
 * scheduled run from turning into an unbounded pile of crawler + Claude calls.
 */
export function selectNewCandidates(
  candidates: Candidate[],
  knownUrls: ReadonlySet<string>,
  knownKeys: ReadonlySet<string>,
  limit: number
): Candidate[] {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 20

  const seenUrls = new Set<string>()
  const seenKeys = new Set<string>()
  const selected: Candidate[] = []

  for (const candidate of candidates) {
    if (selected.length >= safeLimit) break

    if (knownUrls.has(candidate.sourceUrl) || seenUrls.has(candidate.sourceUrl))
      continue

    const key = offerKey(candidate.source, candidate.sourceId)
    if (key !== null && (knownKeys.has(key) || seenKeys.has(key))) continue

    seenUrls.add(candidate.sourceUrl)
    if (key !== null) seenKeys.add(key)
    selected.push(candidate)
  }

  return selected
}

export interface UnclassifiedOffer {
  id: string
  title: string
  raw_text: string | null
  ai_generated_at: string | null
  status: string
}

/**
 * Picks offers that still need classification: no AI summary yet and not dismissed,
 * with some text to work from. This is how manually entered offers (which arrive
 * without a scrape) get their ticker summary on the next scheduled run. Capped.
 */
export function selectUnclassified<T extends UnclassifiedOffer>(
  offers: T[],
  limit: number
): T[] {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 15

  return offers
    .filter((offer) => offer.ai_generated_at === null)
    .filter((offer) => offer.status !== 'dismissed')
    .filter(
      (offer) =>
        (offer.raw_text ?? '').trim() !== '' || offer.title.trim() !== ''
    )
    .slice(0, safeLimit)
}
