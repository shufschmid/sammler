import { categoryLabel, formatDate, recency, sourceLabel, statusLabel } from './offers'

describe('formatDate', () => {
  it('formats a date', () => {
    expect(formatDate('2026-08-30')).toMatch(/2026/)
  })

  it('never renders Invalid Date', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate('kein Datum')).toBe('—')
  })
})

describe('labels', () => {
  it('translates statuses and passes through unknown ones', () => {
    expect(statusLabel('accepted')).toBe('Uebernommen')
    expect(statusLabel('irgendwas')).toBe('irgendwas')
  })

  it('translates sources', () => {
    expect(sourceLabel('fraufasnacht')).toBe('fraufasnacht.ch')
    expect(sourceLabel('manual')).toBe('Manuell')
  })

  it('translates categories and maps null to null', () => {
    expect(categoryLabel('sucht')).toBe('Sucht')
    expect(categoryLabel(null)).toBeNull()
  })
})

describe('recency', () => {
  const now = new Date('2026-09-02T00:00:00Z')

  it('marks evergreen offers as durably valid regardless of date', () => {
    expect(recency('2020-01-01', true, now)).toEqual({
      label: 'Dauerhaft gueltig',
      tone: 'evergreen'
    })
  })

  it('marks offers within a month as fresh, older ones as stale', () => {
    expect(recency('2026-08-20', false, now)?.tone).toBe('fresh')
    expect(recency('2026-06-01', false, now)?.tone).toBe('stale')
  })

  it('returns null without a usable date and not evergreen', () => {
    expect(recency(null, false, now)).toBeNull()
    expect(recency('kein Datum', null, now)).toBeNull()
  })
})
