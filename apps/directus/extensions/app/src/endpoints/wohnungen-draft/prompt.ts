// Pure prompt building, validation and rendering for the "Günstige Wohnungen"-box text.
// House style verified against a year of Wednesday briefings: one short paragraph per flat
// ("An der [Adresse] im [Quartier] steht eine [X-Zimmer-Wohnung] … misst [m²] Quadratmeter
// … für [Miete] Franken"), the link woven onto the "X-Zimmer-Wohnung" phrase, then a fixed
// closing line linking to the public list. Claude writes the sentence + marks the anchor;
// the URL is inserted server-side from source_url (never hallucinated). See prompt.test.ts.

export interface DraftWohnung {
  titel: string
  zimmer: number | null
  flaeche_m2: number | null
  miete_chf: number | null
  adresse: string | null
  plz: string | null
  quartier: string | null
  source_url: string | null
  ai_genossenschaft: boolean | null
}

export interface DraftResult {
  text: string
  html: string
}

const STYLE_EXAMPLES = [
  'An der Fasanenstrasse 122 im Hirzbrunnen steht eine 3.5-Zimmer-Wohnung zur Verfügung. Die Wohnung misst 73 Quadratmeter, hat einen Balkon und ist für 1550 Franken ausgeschrieben.  (linkText: "3.5-Zimmer-Wohnung")',
  'An der Hochbergerstrasse 136 in Kleinhüningen steht eine 2-Zimmer-Wohnung frei. Sie hat 52 Quadratmeter. Die Miete beträgt 1150 Franken.  (linkText: "2-Zimmer-Wohnung")'
]

export const DRAFT_SYSTEM_PROMPT = [
  'Du schreibst die Rubrik "Guenstige Wohnungen in Basel" fuers Basel Briefing von Bajour.',
  'Du bekommst nummerierte Wohnungen und gibst genau ein JSON-Objekt {"entries": [{"n": number, "sentence": string, "linkText": string}]} zurueck.',
  'Pro Wohnung ein bis zwei kurze Saetze im Ton der Beispiele. Nenne Adresse, Quartier (falls vorhanden), Zimmerzahl, Quadratmeter und Miete in Franken.',
  'Baue den Link natuerlich ein und setze "linkText" auf genau die Woerter im Satz, die verlinkt werden (in der Regel die "X-Zimmer-Wohnung"). Der Wert muss woertlich im Satz vorkommen.',
  'Erfinde keine Zahlen oder Adressen. Nutze nur die Angaben aus der Liste; fehlt eine Angabe, lass sie weg.',
  'Behalte die Reihenfolge der Nummern bei und liefere zu jeder einen Eintrag.',
  '',
  'Beispiele fuer Ton und Form (die Klammer zeigt nur den passenden linkText):',
  ...STYLE_EXAMPLES
].join('\n')

export class NoWohnungenError extends Error {
  constructor() {
    super('Es wurden keine Wohnungen fuer den Entwurf uebergeben.')
    this.name = 'NoWohnungenError'
  }
}

function safeHref(url: string | null): string | null {
  if (url === null) return null
  const t = url.trim()
  return /^https?:\/\//i.test(t) ? t : null
}
function escapeHtml(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
function replaceFirst(haystack: string, find: string, replacement: string): string {
  const at = haystack.indexOf(find)
  if (at === -1) return haystack
  return haystack.slice(0, at) + replacement + haystack.slice(at + find.length)
}

export function buildDraftPrompt(wohnungen: DraftWohnung[]): string {
  if (wohnungen.length === 0) throw new NoWohnungenError()
  const lines = wohnungen.map((w, i) => {
    const parts = [`${i + 1}. ${w.titel.trim()}`]
    if (w.adresse) parts.push(`   Adresse: ${w.adresse.trim()}`)
    if (w.quartier) parts.push(`   Quartier: ${w.quartier.trim()}`)
    if (w.zimmer !== null) parts.push(`   Zimmer: ${w.zimmer}`)
    if (w.flaeche_m2 !== null) parts.push(`   Flaeche: ${w.flaeche_m2} m2`)
    if (w.miete_chf !== null) parts.push(`   Miete: ${w.miete_chf} Franken`)
    if (w.ai_genossenschaft) parts.push('   Genossenschaftswohnung')
    parts.push(safeHref(w.source_url) !== null ? '   Link: ja' : '   Link: nein')
    return parts.join('\n')
  })
  return ['Ausgewaehlte Wohnungen:', ...lines].join('\n')
}

export interface DraftEntry {
  sentence: string
  linkText: string | null
}

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
      typeof e.linkText === 'string' && e.linkText.trim() !== '' ? e.linkText.trim() : null
    map.set(e.n, { sentence: e.sentence.trim(), linkText })
  }
  return map
}

function fallback(w: DraftWohnung): string {
  const bits = [w.titel.trim()]
  if (w.adresse) bits.push(`an der ${w.adresse.trim()}`)
  if (w.flaeche_m2 !== null) bits.push(`${w.flaeche_m2} m2`)
  if (w.miete_chf !== null) bits.push(`${w.miete_chf} Franken`)
  return bits.join(', ') + '.'
}

/**
 * Assembles the box: one paragraph per flat (link woven onto the marked anchor) plus the
 * fixed closing line linking to the public list. `text` is the plain fallback with the URL
 * inline; `html` is the rich version for pasting into the newsletter editor.
 */
export function renderDraft(
  wohnungen: DraftWohnung[],
  entries: Map<number, DraftEntry>,
  listeUrl: string
): DraftResult {
  if (wohnungen.length === 0) throw new NoWohnungenError()

  const textParas: string[] = []
  const htmlParas: string[] = []

  wohnungen.forEach((w, index) => {
    const entry = entries.get(index + 1)
    const sentence = entry?.sentence ?? fallback(w)
    const linkText = entry?.linkText ?? null
    const href = safeHref(w.source_url)
    const escaped = escapeHtml(sentence)

    if (href !== null && linkText !== null && sentence.includes(linkText)) {
      const anchor = `<a href="${escapeHtml(href)}">${escapeHtml(linkText)}</a>`
      htmlParas.push(`<p>${replaceFirst(escaped, escapeHtml(linkText), anchor)}</p>`)
      textParas.push(replaceFirst(sentence, linkText, `${linkText} (${href})`))
    } else if (href !== null) {
      htmlParas.push(`<p>${escaped} (<a href="${escapeHtml(href)}">zum Inserat</a>)</p>`)
      textParas.push(`${sentence} (zum Inserat: ${href})`)
    } else {
      htmlParas.push(`<p>${escaped}</p>`)
      textParas.push(sentence)
    }
  })

  const liste = safeHref(listeUrl)
  const closingHtml =
    liste !== null
      ? `<p>Diese und weitere Wohnungen gibt es wöchentlich aktualisiert in unserer <a href="${escapeHtml(liste)}">Liste</a>.</p>`
      : '<p>Diese und weitere Wohnungen gibt es wöchentlich aktualisiert in unserer Liste.</p>'
  const closingText =
    liste !== null
      ? `Diese und weitere Wohnungen gibt es wöchentlich aktualisiert in unserer Liste (${liste}).`
      : 'Diese und weitere Wohnungen gibt es wöchentlich aktualisiert in unserer Liste.'

  return {
    text: [...textParas, closingText].join('\n\n'),
    html: [...htmlParas, closingHtml].join('\n')
  }
}
