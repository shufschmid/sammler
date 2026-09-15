import { createError } from '@directus/errors'
import { defineEndpoint } from '@directus/extensions-sdk'
import type { NextFunction, Response } from 'express'
import { completeJson } from '../../shared/claude'
import { scrape } from '../../shared/crawler'
import { isAuthenticated, type ApiRequest } from '../../shared/http'
import type { Wohnung } from '../../types/schema'
import {
  buildExtractOnePrompt,
  EXTRACT_ONE_SYSTEM_PROMPT,
  parseWohnung,
  wohnungFields
} from '../wohnungen-collect/extract'
import { classifySourceUrl } from '../wohnungen-collect/sources'

// POST /wohnungen-from-url  { url }
//
// "Inserat per Link erfassen": the redaction pastes a listing URL (Homegate, ImmoScout,
// a cooperative, …); the crawler fetches that one page and Claude fills the fields, so a
// portal find is one paste instead of manual typing — without scraping the portals wholesale.
// Synchronous (one page, one Claude call).

const NotSignedInError = createError('FORBIDDEN', 'Anmeldung erforderlich.', 401)
const InvalidUrlError = createError('INVALID_URL', 'Bitte eine gueltige http(s)-URL angeben.', 400)
const AlreadyError = createError('ALREADY_EXISTS', 'Diese Wohnung ist bereits erfasst.', 409)
const ExtractFailedError = createError(
  'EXTRACT_FAILED',
  'Aus dieser Seite liessen sich keine Wohnungsdaten lesen.',
  502
)

const PORTAL_SOURCES = new Set(['homegate', 'immoscout', 'flatfox', 'facebook'])

export default defineEndpoint((router, { services, getSchema, logger }) => {
  const { ItemsService } = services

  router.post('/', async (req: ApiRequest, res: Response, next: NextFunction) => {
    if (!isAuthenticated(req)) return next(new NotSignedInError())

    const url = (req.body as { url?: unknown } | undefined)?.url
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url.trim())) {
      return next(new InvalidUrlError())
    }
    const cleanUrl = url.trim()
    const { source, plattform } = classifySourceUrl(cleanUrl)

    try {
      const page = await scrape(cleanUrl, {
        forcePlaywright: PORTAL_SOURCES.has(source)
      })
      const extraction = parseWohnung(
        await completeJson<unknown>({
          system: EXTRACT_ONE_SYSTEM_PROMPT,
          prompt: buildExtractOnePrompt(cleanUrl, page.markdown),
          maxTokens: 1024
        })
      )
      if (extraction === null) return next(new ExtractFailedError())

      const wohnungen = new ItemsService('wohnungen', {
        schema: await getSchema(),
        accountability: req.accountability
      })
      const id = await wohnungen.createOne({
        status: 'neu',
        ...wohnungFields(
          { source: source as Wohnung['source'], sourceId: null, sourceUrl: cleanUrl, plattform },
          { ...extraction, link: cleanUrl },
          new Date()
        )
      })
      return res.json({ data: { id, ...extraction, source, plattform } })
    } catch (error) {
      // Unique violation on source_url = already captured.
      if ((error as { code?: string })?.code === 'RECORD_NOT_UNIQUE') {
        return next(new AlreadyError())
      }
      logger.error(error, `wohnungen-from-url failed for ${cleanUrl}`)
      return next(new ExtractFailedError())
    }
  })
})
