// Pure presentation helpers for the apartment collector. Rules live here so they can be
// tested without rendering — see wohnungen.test.ts. The backend writes miete_pro_m2 and
// ai_passt/ai_passt_grund into their own fields (hook + criteria.ts); the UI reads them.

/** German date for display. Falls back to an em dash rather than "Invalid Date". */
export function formatDate(value: string | null): string {
  if (value === null) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('de-CH', { dateStyle: 'medium' }).format(date)
}

/** "1'830 Fr." — Swiss grouping, no decimals. Null → em dash. */
export function formatChf(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return `${new Intl.NumberFormat('de-CH', { maximumFractionDigits: 0 }).format(value)} Fr.`
}

/** "22.60 Fr./m²·Jahr" — the annual rent per m² the criteria judge. Null → em dash. */
export function formatMieteProM2(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return `${new Intl.NumberFormat('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} Fr./m²·Jahr`
}

/** "2.5 Zi." — trims a trailing ".0". Null → em dash. */
export function formatZimmer(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return `${new Intl.NumberFormat('de-CH', { maximumFractionDigits: 1 }).format(value)} Zi.`
}

/** "80 m²". Null → em dash. */
export function formatFlaeche(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return `${new Intl.NumberFormat('de-CH', { maximumFractionDigits: 0 }).format(value)} m²`
}

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    neu: 'Neu',
    geprueft: 'Geprueft',
    aufgenommen: 'Uebernommen',
    im_briefing: 'Im Briefing',
    weg: 'Weg',
    verworfen: 'Verworfen'
  }
  return labels[status] ?? status
}

export function sourceLabel(source: string): string {
  const labels: Record<string, string> = {
    unimarkt: 'Unimarkt',
    immobilien_bs: 'Immobilien BS',
    genossenschaft: 'Genossenschaft',
    homegate: 'Homegate',
    immoscout: 'ImmoScout24',
    flatfox: 'Flatfox',
    facebook: 'Facebook',
    mail: 'Mail',
    manuell: 'Manuell',
    custom: 'Eigene Quelle'
  }
  return labels[source] ?? source
}

export interface Fit {
  label: string
  tone: 'pass' | 'warn' | 'fail'
}

/**
 * How the card should badge a flat by the computed criteria result. `ai_passt` is the
 * hook's verdict; `grund` carries the reason (e.g. "grenzwertig" for 250–300 Fr./m²).
 * Returns null when the criteria have not been evaluated yet.
 */
export function fit(passt: boolean | null, grund: string | null): Fit | null {
  if (passt === null) return null
  if (!passt) return { label: 'Passt nicht', tone: 'fail' }
  const reason = grund ?? ''
  if (/grenzwertig|unbekannt/i.test(reason)) return { label: 'Grenzwertig', tone: 'warn' }
  return { label: 'Passt', tone: 'pass' }
}

/** The status values a review moves a flat through, for the filter and the card. */
export const WOHNUNG_STATUSES = ['neu', 'geprueft', 'aufgenommen', 'im_briefing', 'weg', 'verworfen'] as const
export type WohnungStatus = (typeof WOHNUNG_STATUSES)[number]
