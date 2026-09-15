import { describe, expect, it } from 'vitest'
import { bodyText, mailboxConfigured } from './mailbox'

describe('bodyText', () => {
  it('prefers the plain-text part when present', () => {
    expect(
      bodyText({ text: '  Freie Wohnung am Rhein  ', html: '<p>ignored</p>' })
    ).toBe('Freie Wohnung am Rhein')
  })

  it('strips tags out of an HTML-only mail', () => {
    const html =
      '<html><body><h1>2-Zimmer</h1><p>Miete&nbsp;1200 Franken</p></body></html>'
    expect(bodyText({ text: false as never, html })).toBe(
      '2-Zimmer Miete 1200 Franken'
    )
  })

  it('drops script and style blocks', () => {
    const html =
      '<style>.x{color:red}</style><p>Text</p><script>alert(1)</script>'
    expect(bodyText({ text: '', html })).toBe('Text')
  })

  it('decodes the common entities', () => {
    expect(
      bodyText({ text: '', html: '<p>Haus &amp; Hof &lt;Basel&gt;</p>' })
    ).toBe('Haus & Hof <Basel>')
  })

  it('returns empty string when there is nothing usable', () => {
    expect(bodyText({ text: false as never, html: false as never })).toBe('')
  })
})

describe('mailboxConfigured', () => {
  const orig = { ...process.env }
  const reset = () => {
    delete process.env.MAILBOX_HOST
    delete process.env.MAILBOX_USER
    delete process.env.MAILBOX_PASSWORD
  }

  it('is false without host/user/password', () => {
    reset()
    expect(mailboxConfigured()).toBe(false)
    Object.assign(process.env, orig)
  })

  it('is true only when all three are set', () => {
    reset()
    process.env.MAILBOX_HOST = 'taylor.mxrouting.net'
    process.env.MAILBOX_USER = 'wohnungen@example.ch'
    expect(mailboxConfigured()).toBe(false)
    process.env.MAILBOX_PASSWORD = 'secret'
    expect(mailboxConfigured()).toBe(true)
    reset()
    Object.assign(process.env, orig)
  })
})
