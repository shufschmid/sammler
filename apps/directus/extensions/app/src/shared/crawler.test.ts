import { describe, expect, it, vi } from 'vitest'
import {
  CrawlerError,
  parseScrapeResult,
  scrape,
  type CrawlerFetcher
} from './crawler'

describe('parseScrapeResult', () => {
  it('reads markdown and renderer from the data envelope', () => {
    const result = parseScrapeResult({
      data: { markdown: '# Titel', metadata: { renderer: 'playwright' } }
    })

    expect(result).toEqual({ markdown: '# Titel', renderer: 'playwright' })
  })

  it('tolerates a flat shape without a data envelope', () => {
    expect(parseScrapeResult({ markdown: 'text' })).toEqual({
      markdown: 'text',
      renderer: null
    })
  })

  it('throws when there is no markdown', () => {
    expect(() => parseScrapeResult({ data: {} })).toThrow(CrawlerError)
  })

  it('throws on a non-object response', () => {
    expect(() => parseScrapeResult(null)).toThrow(CrawlerError)
  })
})

describe('scrape', () => {
  it('posts to /v1/scrape and returns the parsed result', async () => {
    const fetcher: CrawlerFetcher = vi.fn(async () => ({
      data: { markdown: 'ok', metadata: { renderer: 'httpx' } }
    }))

    const result = await scrape('https://example.test', {}, fetcher)

    expect(result).toEqual({ markdown: 'ok', renderer: 'httpx' })
    expect(fetcher).toHaveBeenCalledWith('/v1/scrape', {
      url: 'https://example.test',
      formats: ['markdown'],
      force_playwright: false
    })
  })

  it('passes force_playwright through', async () => {
    const fetcher: CrawlerFetcher = vi.fn(async () => ({ markdown: 'x' }))

    await scrape('https://example.test', { forcePlaywright: true }, fetcher)

    expect(fetcher).toHaveBeenCalledWith(
      '/v1/scrape',
      expect.objectContaining({ force_playwright: true })
    )
  })
})
