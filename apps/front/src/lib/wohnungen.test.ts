import {
  fit,
  formatChf,
  formatDate,
  formatFlaeche,
  formatMieteProM2,
  formatZimmer,
  sourceLabel,
  statusLabel
} from './wohnungen'

describe('formatChf', () => {
  it('groups thousands and appends the unit', () => {
    expect(formatChf(1830)).toMatch(/1.830 Fr\./)
  })
  it('maps null and NaN to an em dash', () => {
    expect(formatChf(null)).toBe('—')
    expect(formatChf(Number.NaN)).toBe('—')
  })
})

describe('formatMieteProM2', () => {
  it('keeps two decimals and labels the annual basis', () => {
    expect(formatMieteProM2(22.6)).toMatch(/22\.60 Fr\.\/m²·Jahr/)
  })
  it('maps null to an em dash', () => {
    expect(formatMieteProM2(null)).toBe('—')
  })
})

describe('formatZimmer / formatFlaeche', () => {
  it('formats rooms and area', () => {
    expect(formatZimmer(2.5)).toBe('2.5 Zi.')
    expect(formatFlaeche(80)).toBe('80 m²')
  })
  it('maps null to an em dash', () => {
    expect(formatZimmer(null)).toBe('—')
    expect(formatFlaeche(null)).toBe('—')
  })
})

describe('labels', () => {
  it('translates statuses and passes through unknown ones', () => {
    expect(statusLabel('aufgenommen')).toBe('Uebernommen')
    expect(statusLabel('im_briefing')).toBe('Im Briefing')
    expect(statusLabel('irgendwas')).toBe('irgendwas')
  })
  it('translates sources', () => {
    expect(sourceLabel('genossenschaft')).toBe('Genossenschaft')
    expect(sourceLabel('manuell')).toBe('Manuell')
    expect(sourceLabel('mail')).toBe('Mail')
  })
})

describe('fit', () => {
  it('returns null before evaluation', () => {
    expect(fit(null, null)).toBeNull()
  })
  it('badges a clean pass', () => {
    expect(fit(true, 'ok')).toEqual({ label: 'Passt', tone: 'pass' })
  })
  it('warns on borderline and unknown-price passes', () => {
    expect(fit(true, 'Miete/m2/Jahr 280 (grenzwertig, ueber 250)')?.tone).toBe('warn')
    expect(fit(true, 'Preis/m2 unbekannt — bitte pruefen')?.tone).toBe('warn')
  })
  it('badges a fail', () => {
    expect(fit(false, 'moebliert')).toEqual({ label: 'Passt nicht', tone: 'fail' })
  })
})

describe('formatDate', () => {
  it('never renders Invalid Date', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate('kein Datum')).toBe('—')
  })
})
