// Tiny, dependency-free helpers over the Markdown the crawler returns. Kept pure and
// separate so each source adapter's link discovery is unit-testable with a fixture
// string and no network call.

export interface MarkdownLink {
  text: string
  url: string
}

const MARKDOWN_LINK = /\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g

/** Every `[text](url)` link in a Markdown document, in order, duplicates included. */
export function extractLinks(markdown: string): MarkdownLink[] {
  const links: MarkdownLink[] = []
  for (const match of markdown.matchAll(MARKDOWN_LINK)) {
    const text = (match[1] ?? '').trim()
    const url = (match[2] ?? '').trim()
    if (url !== '') links.push({ text, url })
  }
  return links
}

/** Absolutises a possibly-relative href against a base origin. Returns null if unusable. */
export function absoluteUrl(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString()
  } catch {
    return null
  }
}
