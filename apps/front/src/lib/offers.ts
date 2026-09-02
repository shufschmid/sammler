// Pure presentation helpers for offers. Anything with a rule in it goes here so it can
// be tested without rendering a component — see offers.test.ts.
//
// Nothing here parses a derived value apart: the backend writes the category, summary
// and audience into their own fields, so the UI reads them as they are.

/** German date for display. Falls back to an em dash rather than "Invalid Date". */
export function formatDate(value: string | null): string {
  if (value === null) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('de-CH', { dateStyle: 'medium' }).format(date)
}

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    new: 'Neu',
    reviewed: 'Geprueft',
    accepted: 'Uebernommen',
    dismissed: 'Verworfen',
    published: 'Veroeffentlicht'
  }

  return labels[status] ?? status
}

export interface Recency {
  label: string
  /** How the card should treat it: fresh (<1 month), evergreen, or stale. */
  tone: 'fresh' | 'evergreen' | 'stale'
}

const MONTH_MS = 31 * 24 * 60 * 60 * 1000

/**
 * How interesting an offer still is by its date. The most interesting are no older than
 * a month; a long-valid search call (evergreen) stays interesting regardless. Returns
 * null when there is no date to judge and it is not evergreen.
 */
export function recency(
  listedAt: string | null,
  evergreen: boolean | null,
  now: Date = new Date()
): Recency | null {
  if (evergreen === true) return { label: 'Dauerhaft gueltig', tone: 'evergreen' }
  if (listedAt === null) return null

  const date = new Date(listedAt)
  if (Number.isNaN(date.getTime())) return null

  return now.getTime() - date.getTime() <= MONTH_MS
    ? { label: 'Aktuell', tone: 'fresh' }
    : { label: 'Aelter als 1 Monat', tone: 'stale' }
}

export function sourceLabel(source: string): string {
  const labels: Record<string, string> = {
    fraufasnacht: 'fraufasnacht.ch',
    unimarkt: 'Unimarkt',
    fasnacht_ch: 'fasnacht.ch',
    facebook: 'Facebook',
    manual: 'Manuell'
  }

  return labels[source] ?? source
}

export function categoryLabel(category: string | null): string | null {
  if (category === null) return null

  const labels: Record<string, string> = {
    sucht: 'Sucht',
    bietet: 'Bietet',
    verkauft: 'Verkauft'
  }

  return labels[category] ?? category
}

/** The status values a review moves an offer through, for the filter and the card. */
export const OFFER_STATUSES = ['new', 'reviewed', 'accepted', 'dismissed', 'published'] as const
export type OfferStatus = (typeof OFFER_STATUSES)[number]
