import { ImapFlow } from 'imapflow'
import { simpleParser, type ParsedMail } from 'mailparser'
import { envFlag, optionalEnv, requireEnv } from './env'

// The single place where this application reaches the IMAP mailbox (wepublish infra:
// taylor.mxrouting.net:993). Newsletters and reader submissions about free apartments
// land there; the Wohnungen collect run reads the unread messages, hands their text to
// Claude for extraction, and marks each \Seen so the next run skips it.
//
// The mailbox is shared across projects, so a collector claims only its own mail via
// plus-addressing: a message sent to <user>+wohnungen@… is picked up by passing that
// address (or the "+wohnungen" fragment) as `toFilter`. Everything else stays untouched
// and unread for the other collectors.
//
// This is the third deliberate outbound dependency, next to the Claude API and the
// wepublish crawler (root CLAUDE.md, constraint 4). Keep every mailbox access behind
// this module, exactly as model calls go through shared/claude.ts. No filesystem state
// (constraint 5): the \Seen flag on the server is the dedup, nothing is written locally.

const DEFAULT_PORT = 993
const DEFAULT_MAILBOX = 'INBOX'
const MAX_BODY_CHARS = 20_000

export class MailboxError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause })
    this.name = 'MailboxError'
  }
}

export interface MailMessage {
  /** IMAP UID, for logging. */
  uid: number
  subject: string
  from: string
  date: Date | null
  /** Plain-text body (HTML mails are reduced to text). */
  text: string
}

export interface MailFetchOptions {
  /** Mailbox/folder to open. Defaults to IMAP_MAILBOX, then "INBOX". */
  mailbox?: string
  /**
   * Only fetch messages whose To header contains this string — the plus-address (or just
   * the "+tag" fragment) a collector claims. Empty/undefined = every unread message.
   */
  toFilter?: string
}

/**
 * The seam every mailbox read goes through. `max` caps how many unread messages are
 * pulled in one run. Handlers and tests can pass a stub and never open a socket — the
 * same pattern as `MessageSender` in shared/claude.ts and `CrawlerFetcher` in crawler.ts.
 */
export type MailFetcher = (
  max: number,
  options?: MailFetchOptions
) => Promise<MailMessage[]>

/** True when the mailbox is configured; callers use this to skip the IMAP pass. */
export function mailboxConfigured(): boolean {
  return (
    optionalEnv('IMAP_HOST', '') !== '' &&
    optionalEnv('IMAP_USER', '') !== '' &&
    optionalEnv('IMAP_PASSWORD', '') !== ''
  )
}

/** Prefer the text part; otherwise strip tags out of the HTML part. Never empty-throws. */
export function bodyText(parsed: Pick<ParsedMail, 'text' | 'html'>): string {
  const text = typeof parsed.text === 'string' ? parsed.text.trim() : ''
  if (text !== '') return text.slice(0, MAX_BODY_CHARS)
  const html = typeof parsed.html === 'string' ? parsed.html : ''
  if (html === '') return ''
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim()
    .slice(0, MAX_BODY_CHARS)
}

/**
 * The default fetcher: connect over TLS, read the unread messages (optionally only those
 * addressed to `toFilter`), and mark each one \Seen so it is not read again. Requires
 * IMAP_HOST/USER/PASSWORD — callers that treat the mailbox as optional must check
 * `mailboxConfigured()` first.
 */
export const fetchUnreadMail: MailFetcher = async (max, options = {}) => {
  if (max <= 0) return []

  const mailbox =
    options.mailbox ?? optionalEnv('IMAP_MAILBOX', DEFAULT_MAILBOX)
  const toFilter = options.toFilter?.trim() ?? ''

  const client = new ImapFlow({
    host: requireEnv('IMAP_HOST'),
    port: Number(optionalEnv('IMAP_PORT', String(DEFAULT_PORT))),
    secure: envFlag('IMAP_SECURE', true),
    auth: {
      user: requireEnv('IMAP_USER'),
      pass: requireEnv('IMAP_PASSWORD')
    },
    logger: false
  })

  const out: MailMessage[] = []
  try {
    await client.connect()
  } catch (cause) {
    throw new MailboxError('IMAP connect failed', cause)
  }

  try {
    const lock = await client.getMailboxLock(mailbox)
    try {
      const criteria =
        toFilter === '' ? { seen: false } : { seen: false, to: toFilter }
      const uids = await client.search(criteria, { uid: true })
      const pick = (Array.isArray(uids) ? uids : []).slice(0, max)
      for (const uid of pick) {
        const msg = await client.fetchOne(uid, { source: true }, { uid: true })
        if (!msg || !msg.source) continue
        const parsed = await simpleParser(msg.source)
        out.push({
          uid,
          subject: parsed.subject ?? '',
          from: parsed.from?.text ?? '',
          date: parsed.date ?? null,
          text: bodyText(parsed)
        })
        // Mark read before moving on: a crash mid-run must not re-import the rest,
        // and this is our only dedup (no local state, constraint 5).
        await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true })
      }
    } finally {
      lock.release()
    }
  } catch (cause) {
    throw new MailboxError('IMAP read failed', cause)
  } finally {
    await client.logout().catch(() => {})
  }

  return out
}
