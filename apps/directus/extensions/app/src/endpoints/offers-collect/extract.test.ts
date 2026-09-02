import { describe, expect, it } from 'vitest'
import {
  buildExtractManyPrompt,
  buildExtractPrompt,
  classificationFields,
  EmptyPageError,
  offerFields,
  parseExtraction,
  parseExtractionList,
  type Extraction
} from './extract'

describe('buildExtractPrompt', () => {
  it('includes source label, url and markdown', () => {
    const prompt = buildExtractPrompt(
      'fraufasnacht',
      'https://x.test',
      '# Hallo'
    )
    expect(prompt).toContain('fraufasnacht.ch')
    expect(prompt).toContain('https://x.test')
    expect(prompt).toContain('# Hallo')
  })

  it('throws on blank markdown', () => {
    expect(() => buildExtractPrompt('manual', '', '   ')).toThrow(
      EmptyPageError
    )
  })
})

describe('parseExtraction', () => {
  it('accepts a valid offer answer including evergreen', () => {
    const result = parseExtraction({
      isOffer: true,
      title: 'Trommelmaersche gesucht',
      category: 'sucht',
      summary: 'Vier Tambouren suchen unveroeffentlichte Trommelmaersche.',
      audience: 'Tambouren',
      contact: 'info@drummelbuech.ch',
      listedAt: '2026-05-22',
      evergreen: true
    })

    expect(result).toEqual({
      isOffer: true,
      title: 'Trommelmaersche gesucht',
      category: 'sucht',
      summary: 'Vier Tambouren suchen unveroeffentlichte Trommelmaersche.',
      audience: 'Tambouren',
      contact: 'info@drummelbuech.ch',
      listedAt: '2026-05-22',
      evergreen: true
    })
  })

  it('coerces isOffer/evergreen to strict booleans and rejects bad categories/dates', () => {
    const result = parseExtraction({
      isOffer: 'yes',
      title: 'x',
      category: 'schenkt',
      summary: 's',
      listedAt: '18.02.2026',
      evergreen: 'ja'
    })

    expect(result.isOffer).toBe(false)
    expect(result.category).toBeNull()
    expect(result.listedAt).toBeNull()
    expect(result.evergreen).toBe(false)
  })

  it('defaults missing optional fields to null/false and empty title to ""', () => {
    const result = parseExtraction({ isOffer: true })
    expect(result).toMatchObject({
      title: '',
      category: null,
      summary: null,
      audience: null,
      contact: null,
      listedAt: null,
      evergreen: false
    })
  })

  it('throws on a non-object', () => {
    expect(() => parseExtraction('nope')).toThrow()
  })
})

describe('parseExtractionList', () => {
  it('reads the offers array and drops entries without a title', () => {
    const offers = parseExtractionList({
      offers: [
        {
          title: 'Larve zu verkaufen',
          category: 'verkauft',
          summary: 's',
          link: 'https://x.test/1'
        },
        { category: 'sucht', summary: 'kein Titel' },
        'garbage'
      ]
    })

    expect(offers).toHaveLength(1)
    expect(offers[0]).toMatchObject({
      title: 'Larve zu verkaufen',
      category: 'verkauft',
      link: 'https://x.test/1',
      evergreen: false
    })
  })

  it('tolerates a bare array and a missing/!array offers field', () => {
    expect(parseExtractionList([{ title: 'A' }])).toHaveLength(1)
    expect(parseExtractionList({})).toEqual([])
    expect(parseExtractionList(null)).toEqual([])
  })
})

describe('buildExtractManyPrompt', () => {
  it('includes the source name, url and markdown', () => {
    const prompt = buildExtractManyPrompt(
      'Guggen-Forum',
      'https://q.test',
      '# Liste'
    )
    expect(prompt).toContain('Guggen-Forum')
    expect(prompt).toContain('https://q.test')
    expect(prompt).toContain('# Liste')
  })
})

describe('offerFields / classificationFields', () => {
  const extraction: Extraction = {
    isOffer: true,
    title: 'Titel',
    category: 'verkauft',
    summary: 'Verkauft wird eine Larve.',
    audience: 'Sammler*innen',
    contact: 'a@b.ch',
    listedAt: '2026-08-30',
    evergreen: false
  }
  const when = new Date('2026-09-02T06:00:00Z')

  it('maps an extraction onto the full column set including ai_evergreen', () => {
    const fields = offerFields(
      { source: 'fraufasnacht', sourceId: '157', sourceUrl: 'https://x.test' },
      '  Larve, CHF 80  ',
      extraction,
      when
    )

    expect(fields).toMatchObject({
      source: 'fraufasnacht',
      source_id: '157',
      source_url: 'https://x.test',
      title: 'Titel',
      raw_text: 'Larve, CHF 80',
      contact: 'a@b.ch',
      listed_at: '2026-08-30',
      ai_category: 'verkauft',
      ai_summary: 'Verkauft wird eine Larve.',
      ai_audience: 'Sammler*innen',
      ai_evergreen: false,
      ai_generated_at: when.toISOString()
    })
  })

  it('falls back to a generic title when none was extracted', () => {
    const fields = offerFields(
      { source: 'manual', sourceId: null, sourceUrl: 'x' },
      'text',
      { ...extraction, title: '' },
      when
    )
    expect(fields.title).toBe('Ohne Titel')
  })

  it('classificationFields writes only the ai_* columns', () => {
    expect(
      classificationFields({ ...extraction, evergreen: true }, when)
    ).toEqual({
      ai_category: 'verkauft',
      ai_summary: 'Verkauft wird eine Larve.',
      ai_audience: 'Sammler*innen',
      ai_evergreen: true,
      ai_generated_at: when.toISOString()
    })
  })
})
