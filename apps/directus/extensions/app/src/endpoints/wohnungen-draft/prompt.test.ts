import { describe, expect, it } from 'vitest'
import {
  buildDraftPrompt,
  NoWohnungenError,
  parseDraftEntries,
  renderDraft,
  type DraftWohnung
} from './prompt'

function wohnung(p: Partial<DraftWohnung>): DraftWohnung {
  return {
    titel: '3-Zimmer-Wohnung',
    zimmer: 3,
    flaeche_m2: 73,
    miete_chf: 1550,
    adresse: 'Fasanenstrasse 122',
    plz: '4057',
    quartier: 'Hirzbrunnen',
    source_url: 'https://homegate.ch/x',
    ai_genossenschaft: false,
    ...p
  }
}

const LISTE = 'https://bajour.ch/freie-wohnungen-basel'

describe('buildDraftPrompt', () => {
  it('numbers flats with address, rooms, area, rent and link flag', () => {
    const p = buildDraftPrompt([wohnung({})])
    expect(p).toContain('1. 3-Zimmer-Wohnung')
    expect(p).toContain('Fasanenstrasse 122')
    expect(p).toContain('Hirzbrunnen')
    expect(p).toContain('73 m2')
    expect(p).toContain('1550 Franken')
    expect(p).toContain('Link: ja')
  })
  it('throws on empty', () => {
    expect(() => buildDraftPrompt([])).toThrow(NoWohnungenError)
  })
})

describe('renderDraft', () => {
  it('weaves the link, one paragraph per flat, plus the closing list line', () => {
    const { text, html } = renderDraft(
      [wohnung({})],
      new Map([
        [
          1,
          {
            sentence:
              'An der Fasanenstrasse 122 im Hirzbrunnen steht eine 3.5-Zimmer-Wohnung zur Verfügung. Sie misst 73 Quadratmeter und ist für 1550 Franken ausgeschrieben.',
            linkText: '3.5-Zimmer-Wohnung'
          }
        ]
      ]),
      LISTE
    )
    expect(html).toContain('<a href="https://homegate.ch/x">3.5-Zimmer-Wohnung</a>')
    expect(html).toContain(`<a href="${LISTE}">Liste</a>`)
    expect(text).toContain('3.5-Zimmer-Wohnung (https://homegate.ch/x)')
    expect(text).toContain('wöchentlich aktualisiert in unserer Liste')
  })

  it('falls back to the flat data when the model skipped an entry', () => {
    const { text } = renderDraft([wohnung({ source_url: null })], new Map(), LISTE)
    expect(text).toContain('Fasanenstrasse 122')
  })

  it('parseDraftEntries maps by number and drops malformed', () => {
    const m = parseDraftEntries({
      entries: [{ n: 1, sentence: 'S', linkText: 'x' }, { n: 2, sentence: '' }]
    })
    expect(m.get(1)).toEqual({ sentence: 'S', linkText: 'x' })
    expect(m.has(2)).toBe(false)
  })
})
