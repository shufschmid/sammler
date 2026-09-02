import type { OfferCategory } from '../../types/schema'

// Pure prompt building, answer validation and rendering for the Vermittlungsbüro ticker
// draft. Everything testable without a network call lives here; index.ts keeps only the
// Directus wiring. See prompt.test.ts.
//
// Claude writes one sentence per offer in the briefing's house style AND weaves a natural,
// varied reference to the source into it ("das Angebot findest du auf fraufasnacht.ch",
// "hier geht's zum Inserat", "die Liste steht in der Facebook-Gruppe"), marking the exact
// words that should be the link via `linkText`. We turn that anchor into a real hyperlink
// pointing at the stored `source_url` — so the phrasing is natural and varied, but the URL
// is never hallucinated. The result is produced twice: `html` (anchor as a clickable <a>,
// for pasting a rich ticker into an email) and `text` (plain fallback with the URL inline).

export interface DraftOffer {
  title: string
  raw_text: string | null
  contact: string | null
  source: string
  source_url: string | null
  ai_category: OfferCategory | null
  ai_summary: string | null
  ai_audience: string | null
}

export interface DraftResult {
  text: string
  html: string
}

// Human source name for the prompt hint, so Claude can phrase the link naturally.
const SOURCE_NAMES: Record<string, string> = {
  fraufasnacht: 'fraufasnacht.ch',
  unimarkt: 'dem Unimarkt (markt.unibas.ch)',
  fasnacht_ch: 'fasnacht.ch',
  facebook: 'der Facebook-Gruppe «Rund um d’Fasnacht Basel & Regio»',
  custom: 'der Quelle'
}

// Fallback anchor if Claude marks no linkText but a link exists.
const SOURCE_ANCHORS: Record<string, string> = {
  fraufasnacht: 'auf fraufasnacht.ch',
  unimarkt: 'auf dem Unimarkt',
  fasnacht_ch: 'auf fasnacht.ch',
  facebook: 'via Facebook',
  custom: 'zur Anzeige'
}

/** Only http(s) links are embedded — guards the rendered HTML against javascript: hrefs. */
function safeHref(url: string | null): string | null {
  if (url === null) return null
  const trimmed = url.trim()
  return /^https?:\/\//i.test(trimmed) ? trimmed : null
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Replaces the first occurrence of `find` in `haystack` using a function replacement. */
function replaceFirst(
  haystack: string,
  find: string,
  replacement: string
): string {
  const at = haystack.indexOf(find)
  if (at === -1) return haystack
  return haystack.slice(0, at) + replacement + haystack.slice(at + find.length)
}

// Verbatim-flavoured examples for the house style, showing the link woven in and varied.
const STYLE_EXAMPLES = [
  'Der Dupf Club sucht Hilfe beim Laternenziehen – hier geht’s zum Inserat.  (linkText: "hier geht’s zum Inserat")',
  'Désirée Fedeli sucht ein Bläch-Sousi, das Angebot findest du auf fraufasnacht.ch.  (linkText: "auf fraufasnacht.ch")',
  'Diverse Guggen suchen neue Mitglieder in allen Registern, die aktuelle Liste steht in der Facebook-Gruppe.  (linkText: "in der Facebook-Gruppe")',
  'Das Restaurant Pera sucht einen Hilfskoch für die Fasnacht – melde dich hier.  (linkText: "melde dich hier")',
  'Eine komplette Fasnachtsplaketten-Sammlung wechselt die Hand, mehr dazu im Unimarkt.  (linkText: "im Unimarkt")'
]

export const DRAFT_SYSTEM_PROMPT = [
  'Du schreibst die Rubrik «Vermittlungsbuero» fuer das Fasnachts-Briefing von Bajour (Basler Fasnacht).',
  'Du bekommst nummerierte Inserate und gibst genau ein JSON-Objekt {"entries": [{"n": number, "sentence": string, "linkText": string|null}]} zurueck.',
  'Pro Inserat genau EIN kompakter Satz in der Gegenwart, sachlich und im lebendigen Ton der Basler Fasnacht. Kontaktangaben (Name, Telefon, E-Mail) nennst du am Ende des Satzes, sofern vorhanden.',
  'Wenn zum Inserat ein Link angegeben ist ("Link: ja"), baust du den Verweis auf die Quelle NATUERLICH in den Satz ein und setzt "linkText" auf genau die Woerter im Satz, die verlinkt werden sollen (der Wert muss woertlich im Satz vorkommen).',
  'Variiere die Verweise ueber die Eintraege hinweg und stelle sie nicht immer ans Satzende. Beispiele fuer solche Verweise: «auf fraufasnacht.ch», «im Unimarkt», «in der Facebook-Gruppe», «hier geht’s zum Inserat», «das Angebot findest du hier», «melde dich hier», «mehr dazu auf fasnacht.ch».',
  'Erfinde KEINE URL und keine Quelle: nutze den Verweis nur, wenn "Link: ja" steht. Steht "Link: nein", ist linkText null und der Satz nennt keine Quelle.',
  'Behalte die vorgegebene Reihenfolge der Nummern bei und liefere zu jeder Nummer einen Eintrag.',
  'Erfinde keine Inserate und keine Kontaktdaten. Verwende nur, was in der Liste steht.',
  '',
  'Beispiele fuer Ton, Einbau und Variation (die Klammer zeigt nur den passenden linkText, sie gehoert nicht in den Satz):',
  ...STYLE_EXAMPLES
].join('\n')

export class NoOffersError extends Error {
  constructor() {
    super('Es wurden keine Inserate fuer den Entwurf uebergeben.')
    this.name = 'NoOffersError'
  }
}

const CATEGORY_ORDER: Record<OfferCategory, number> = {
  sucht: 0,
  bietet: 1,
  verkauft: 2
}

/** Ticker order: sucht → bietet → verkauft, stable otherwise. Shared by prompt + render. */
export function sortForTicker(offers: DraftOffer[]): DraftOffer[] {
  const rank = (offer: DraftOffer) =>
    offer.ai_category === null ? 3 : CATEGORY_ORDER[offer.ai_category]
  return [...offers].sort((a, b) => rank(a) - rank(b))
}

export function buildDraftPrompt(offers: DraftOffer[]): string {
  if (offers.length === 0) throw new NoOffersError()

  const lines = sortForTicker(offers).map((offer, index) => {
    const body =
      offer.ai_summary !== null && offer.ai_summary.trim() !== ''
        ? offer.ai_summary.trim()
        : (offer.raw_text ?? offer.title).trim()

    const hasLink = safeHref(offer.source_url) !== null
    const parts = [`${index + 1}. ${offer.title.trim()}: ${body}`]
    if (offer.ai_category !== null)
      parts.push(`   Kategorie: ${offer.ai_category}`)
    if (offer.ai_audience !== null && offer.ai_audience.trim() !== '')
      parts.push(`   Zielgruppe: ${offer.ai_audience.trim()}`)
    if (offer.contact !== null && offer.contact.trim() !== '')
      parts.push(`   Kontakt: ${offer.contact.trim()}`)
    if (hasLink)
      parts.push(
        `   Link: ja (Quelle: ${SOURCE_NAMES[offer.source] ?? offer.source})`
      )
    else parts.push('   Link: nein')

    return parts.join('\n')
  })

  return ['Ausgewaehlte Inserate:', ...lines].join('\n')
}

export interface DraftEntry {
  sentence: string
  linkText: string | null
}

/** Maps the model's entries back to {sentence, linkText} by number. Tolerates a missing few. */
export function parseDraftEntries(value: unknown): Map<number, DraftEntry> {
  const container = value as { entries?: unknown } | null
  const list = Array.isArray(value)
    ? value
    : Array.isArray(container?.entries)
      ? container.entries
      : []

  const map = new Map<number, DraftEntry>()
  for (const entry of list) {
    if (typeof entry !== 'object' || entry === null) continue
    const e = entry as { n?: unknown; sentence?: unknown; linkText?: unknown }
    if (typeof e.n !== 'number') continue
    if (typeof e.sentence !== 'string' || e.sentence.trim() === '') continue
    const linkText =
      typeof e.linkText === 'string' && e.linkText.trim() !== ''
        ? e.linkText.trim()
        : null
    map.set(e.n, { sentence: e.sentence.trim(), linkText })
  }
  return map
}

function fallbackSentence(offer: DraftOffer): string {
  return offer.ai_summary !== null && offer.ai_summary.trim() !== ''
    ? offer.ai_summary.trim()
    : (offer.raw_text ?? offer.title).trim()
}

/**
 * Assembles the ticker from the model's sentences, turning each marked anchor into a link
 * to the offer's real URL. Produces a rich-HTML paragraph (for pasting into an email) and
 * a plain-text fallback with the URL inline. Every offer appears, even if the model
 * skipped its number or the anchor did not match — then a short source phrase is appended.
 */
export function renderDraft(
  offers: DraftOffer[],
  entries: Map<number, DraftEntry>
): DraftResult {
  if (offers.length === 0) throw new NoOffersError()

  const ordered = sortForTicker(offers)
  const textItems: string[] = []
  const htmlItems: string[] = []

  ordered.forEach((offer, index) => {
    const entry = entries.get(index + 1)
    const sentence = entry?.sentence ?? fallbackSentence(offer)
    const linkText = entry?.linkText ?? null
    const href = safeHref(offer.source_url)
    const escapedSentence = escapeHtml(sentence)

    if (href !== null && linkText !== null && sentence.includes(linkText)) {
      // Woven-in link: turn the marked anchor words into a hyperlink in place.
      const anchorHtml = `<a href="${escapeHtml(href)}">${escapeHtml(linkText)}</a>`
      htmlItems.push(
        replaceFirst(escapedSentence, escapeHtml(linkText), anchorHtml)
      )
      textItems.push(replaceFirst(sentence, linkText, `${linkText} (${href})`))
    } else if (href !== null) {
      // A link exists but the model gave no usable anchor — append a short source phrase.
      const anchor = SOURCE_ANCHORS[offer.source] ?? 'zur Anzeige'
      htmlItems.push(
        `${escapedSentence} (<a href="${escapeHtml(href)}">${escapeHtml(anchor)}</a>)`
      )
      textItems.push(`${sentence} (${anchor}: ${href})`)
    } else {
      // No link (e.g. reader submission): sentence as-is.
      htmlItems.push(escapedSentence)
      textItems.push(sentence)
    }
  })

  return {
    text: `+++ ${textItems.join(' +++ ')} +++`,
    html: `<p>+++ ${htmlItems.join(' +++ ')} +++</p>`
  }
}
