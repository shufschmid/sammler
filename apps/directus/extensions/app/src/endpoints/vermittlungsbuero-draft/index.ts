import { createError } from '@directus/errors'
import { defineEndpoint } from '@directus/extensions-sdk'
import type { NextFunction, Response } from 'express'
import { completeJson } from '../../shared/claude'
import { isAuthenticated, type ApiRequest } from '../../shared/http'
import {
  buildDraftPrompt,
  DRAFT_SYSTEM_PROMPT,
  NoOffersError,
  parseDraftEntries,
  renderDraft,
  type DraftOffer
} from './prompt'

// POST /vermittlungsbuero-draft
//
// Body: { ids: string[] } — the offers the redaction selected. Reads them through a
// Directus service (so the caller's permissions apply), asks Claude for one house-style
// sentence per offer, then assembles the "+++"-ticker with a linked source phrase per
// item. Returns { text, html }: html for pasting a rich, clickable ticker into an email,
// text as the plain fallback. Nothing is persisted here.

const NotSignedInError = createError(
  'FORBIDDEN',
  'Anmeldung erforderlich.',
  401
)
const InvalidSelectionError = createError(
  'INVALID_SELECTION',
  'Keine gueltigen Inserate ausgewaehlt.',
  400
)
// One status for "none found or none readable", so a caller cannot probe which ids
// exist by comparing error responses.
const NoAccessibleOffersError = createError(
  'FORBIDDEN',
  'Keine der ausgewaehlten Inserate ist verfuegbar.',
  403
)
const DraftFailedError = createError(
  'DRAFT_FAILED',
  'Der Vermittlungsbuero-Text konnte nicht erzeugt werden.',
  502
)

const UUID = /^[0-9a-f-]{36}$/i
const MAX_IDS = 50

function validIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const ids = value.filter(
    (entry): entry is string => typeof entry === 'string' && UUID.test(entry)
  )
  return [...new Set(ids)].slice(0, MAX_IDS)
}

export default defineEndpoint((router, { services, getSchema, logger }) => {
  const { ItemsService } = services

  router.post(
    '/',
    async (req: ApiRequest, res: Response, next: NextFunction) => {
      if (!isAuthenticated(req)) return next(new NotSignedInError())

      const ids = validIds((req.body as { ids?: unknown } | undefined)?.ids)
      if (ids.length === 0) return next(new InvalidSelectionError())

      const offers = new ItemsService('offers', {
        schema: await getSchema(),
        accountability: req.accountability
      })

      let selected: DraftOffer[]
      try {
        selected = (await offers.readByQuery({
          filter: { id: { _in: ids } },
          limit: MAX_IDS,
          fields: [
            'title',
            'raw_text',
            'contact',
            'source',
            'source_url',
            'ai_category',
            'ai_summary',
            'ai_audience'
          ]
        })) as DraftOffer[]
      } catch (error) {
        logger.error(error, 'vermittlungsbuero-draft could not read offers')
        return next(error)
      }

      if (selected.length === 0) return next(new NoAccessibleOffersError())

      try {
        const entries = parseDraftEntries(
          await completeJson<unknown>({
            system: DRAFT_SYSTEM_PROMPT,
            prompt: buildDraftPrompt(selected),
            maxTokens: 2000
          })
        )

        return res.json({ data: renderDraft(selected, entries) })
      } catch (error) {
        // An empty selection is caught above; NoOffersError here would be a bug.
        if (error instanceof NoOffersError)
          return next(new InvalidSelectionError())

        // Log the cause, return a stable error. Never leak a raw provider error (it can
        // contain the prompt) to the browser.
        logger.error(error, 'vermittlungsbuero-draft failed')
        return next(new DraftFailedError())
      }
    }
  )
})
