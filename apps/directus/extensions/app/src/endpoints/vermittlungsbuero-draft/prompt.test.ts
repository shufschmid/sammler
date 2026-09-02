import { describe, expect, it } from 'vitest'
import {
  buildDraftPrompt,
  NoOffersError,
  parseDraftEntries,
  renderDraft,
  type DraftOffer
} from './prompt'

function offer(partial: Partial<DraftOffer>): DraftOffer {
  return {
    title: 'Titel',
    raw_text: null,
    contact: null,
    source: 'fraufasnacht',
    source_url: null,
    ai_category: null,
    ai_summary: null,
    ai_audience: null,
    ...partial
  }
}

describe('buildDraftPrompt', () => {
  it('numbers offers, lists summary/contact, and flags whether a link exists — without the url', () => {
    const prompt = buildDraftPrompt([
      offer({
        title: 'Hilfskoch',
        ai_summary: 'Pera sucht einen Hilfskoch.',
        contact: 'pera@x.ch',
        source_url: 'https://x.test/1'
      })
    ])

    expect(prompt).toContain('1. Hilfskoch')
    expect(prompt).toContain('Pera sucht einen Hilfskoch.')
    expect(prompt).toContain('pera@x.ch')
    expect(prompt).toContain('Link: ja (Quelle: fraufasnacht.ch)')
    expect(prompt).not.toContain('https://x.test/1')
  })

  it('flags Link: nein when there is no usable url', () => {
    const prompt = buildDraftPrompt([
      offer({ source: 'manual', source_url: null })
    ])
    expect(prompt).toContain('Link: nein')
  })

  it('orders sucht before bietet before verkauft', () => {
    const prompt = buildDraftPrompt([
      offer({ title: 'V', ai_category: 'verkauft', ai_summary: 'v' }),
      offer({ title: 'S', ai_category: 'sucht', ai_summary: 's' }),
      offer({ title: 'B', ai_category: 'bietet', ai_summary: 'b' })
    ])

    expect(prompt.indexOf('1. S')).toBeLessThan(prompt.indexOf('2. B'))
    expect(prompt.indexOf('2. B')).toBeLessThan(prompt.indexOf('3. V'))
  })

  it('throws on an empty selection', () => {
    expect(() => buildDraftPrompt([])).toThrow(NoOffersError)
  })
})

describe('parseDraftEntries', () => {
  it('maps sentence and linkText by number and skips malformed ones', () => {
    const map = parseDraftEntries({
      entries: [
        {
          n: 1,
          sentence: 'Erster Satz auf fraufasnacht.ch.',
          linkText: 'auf fraufasnacht.ch'
        },
        { n: 2, sentence: 'Zweiter Satz.', linkText: '' },
        { n: 3, sentence: '' },
        'garbage'
      ]
    })
    expect(map.get(1)).toEqual({
      sentence: 'Erster Satz auf fraufasnacht.ch.',
      linkText: 'auf fraufasnacht.ch'
    })
    expect(map.get(2)).toEqual({ sentence: 'Zweiter Satz.', linkText: null })
    expect(map.has(3)).toBe(false)
  })

  it('returns an empty map for a shapeless answer', () => {
    expect(parseDraftEntries({}).size).toBe(0)
    expect(parseDraftEntries(null).size).toBe(0)
  })
})

describe('renderDraft', () => {
  it('weaves the marked anchor into the sentence as a link (html) and inlines the url (text)', () => {
    const offers = [
      offer({
        source: 'fraufasnacht',
        source_url: 'https://fraufasnacht.ch/x?id=24'
      })
    ]
    const entries = new Map([
      [
        1,
        {
          sentence:
            'Verkauft wird eine FCB-Larve, mehr dazu auf fraufasnacht.ch.',
          linkText: 'auf fraufasnacht.ch'
        }
      ]
    ])
    const { text, html } = renderDraft(offers, entries)

    expect(html).toBe(
      '<p>+++ Verkauft wird eine FCB-Larve, mehr dazu <a href="https://fraufasnacht.ch/x?id=24">auf fraufasnacht.ch</a>. +++</p>'
    )
    expect(text).toBe(
      '+++ Verkauft wird eine FCB-Larve, mehr dazu auf fraufasnacht.ch (https://fraufasnacht.ch/x?id=24). +++'
    )
  })

  it('links the exact facebook post through the woven anchor', () => {
    const { html } = renderDraft(
      [
        offer({
          source: 'facebook',
          source_url: 'https://www.facebook.com/groups/1/posts/9'
        })
      ],
      new Map([
        [
          1,
          {
            sentence:
              'Guggen suchen Mitglieder, die Liste steht in der Facebook-Gruppe.',
            linkText: 'in der Facebook-Gruppe'
          }
        ]
      ])
    )
    expect(html).toContain(
      '<a href="https://www.facebook.com/groups/1/posts/9">in der Facebook-Gruppe</a>'
    )
  })

  it('appends a short source phrase when the model gave no usable anchor', () => {
    const { html, text } = renderDraft(
      [
        offer({
          source: 'fraufasnacht',
          source_url: 'https://fraufasnacht.ch/x'
        })
      ],
      new Map([[1, { sentence: 'Verkauft wird eine Larve.', linkText: null }]])
    )
    expect(html).toContain(
      'Verkauft wird eine Larve. (<a href="https://fraufasnacht.ch/x">auf fraufasnacht.ch</a>)'
    )
    expect(text).toBe(
      '+++ Verkauft wird eine Larve. (auf fraufasnacht.ch: https://fraufasnacht.ch/x) +++'
    )
  })

  it('adds no link for a non-http url or a reader submission', () => {
    const evil = renderDraft(
      [offer({ source: 'facebook', source_url: 'javascript:alert(1)' })],
      new Map([
        [
          1,
          {
            sentence: 'Test in der Facebook-Gruppe.',
            linkText: 'in der Facebook-Gruppe'
          }
        ]
      ])
    )
    expect(evil.html).not.toContain('<a')

    const manual = renderDraft(
      [offer({ source: 'manual', source_url: null })],
      new Map([[1, { sentence: 'Zuschrift.', linkText: null }]])
    )
    expect(manual.text).toBe('+++ Zuschrift. +++')
  })

  it('escapes html in the sentence', () => {
    const { html } = renderDraft(
      [offer({ source: 'manual' })],
      new Map([[1, { sentence: 'Suche <b>Larve</b> & mehr', linkText: null }]])
    )
    expect(html).toContain('Suche &lt;b&gt;Larve&lt;/b&gt; &amp; mehr')
  })

  it('falls back to the offer summary when the model skipped its number', () => {
    const { text } = renderDraft(
      [offer({ source: 'manual', ai_summary: 'Fallback-Satz.' })],
      new Map()
    )
    expect(text).toContain('Fallback-Satz.')
  })

  it('throws on an empty selection', () => {
    expect(() => renderDraft([], new Map())).toThrow(NoOffersError)
  })
})
