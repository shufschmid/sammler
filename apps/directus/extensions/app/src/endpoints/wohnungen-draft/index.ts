import { createError } from '@directus/errors'
import { defineEndpoint } from '@directus/extensions-sdk'
import type { NextFunction, Response } from 'express'
import { completeJson } from '../../shared/claude'
import { optionalEnv } from '../../shared/env'
import { isAuthenticated, type ApiRequest } from '../../shared/http'
import {
  buildDraftPrompt,
  DRAFT_SYSTEM_PROMPT,
  NoWohnungenError,
  parseDraftEntries,
  renderDraft,
  type DraftWohnung
} from './prompt'

// POST /wohnungen-draft  { ids }
//
// Generates the "Günstige Wohnungen in Basel" box for the selected (usually 2) flats in the
// verified house style, with the link woven in and the fixed closing line. Returns
// { text, html } for pasting into the newsletter editor.

const NotSignedInError = createError('FORBIDDEN', 'Anmeldung erforderlich.', 401)
const InvalidSelectionError = createError('INVALID_SELECTION', 'Keine gueltigen Wohnungen ausgewaehlt.', 400)
const NoAccessError = createError('FORBIDDEN', 'Keine der ausgewaehlten Wohnungen ist verfuegbar.', 403)
const DraftFailedError = createError('DRAFT_FAILED', 'Der Wohnungs-Text konnte nicht erzeugt werden.', 502)

const DEFAULT_LISTE_URL = 'https://bajour.ch/freie-wohnungen-basel'
const UUID = /^[0-9a-f-]{36}$/i
const MAX_IDS = 10

function validIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const ids = value.filter((e): e is string => typeof e === 'string' && UUID.test(e))
  return [...new Set(ids)].slice(0, MAX_IDS)
}

export default defineEndpoint((router, { services, getSchema, logger }) => {
  const { ItemsService } = services

  router.post('/', async (req: ApiRequest, res: Response, next: NextFunction) => {
    if (!isAuthenticated(req)) return next(new NotSignedInError())

    const ids = validIds((req.body as { ids?: unknown } | undefined)?.ids)
    if (ids.length === 0) return next(new InvalidSelectionError())

    const wohnungen = new ItemsService('wohnungen', {
      schema: await getSchema(),
      accountability: req.accountability
    })

    let selected: DraftWohnung[]
    try {
      selected = (await wohnungen.readByQuery({
        filter: { id: { _in: ids } },
        limit: MAX_IDS,
        fields: [
          'titel',
          'zimmer',
          'flaeche_m2',
          'miete_chf',
          'adresse',
          'plz',
          'quartier',
          'source_url',
          'ai_genossenschaft'
        ]
      })) as DraftWohnung[]
    } catch (error) {
      logger.error(error, 'wohnungen-draft could not read wohnungen')
      return next(error)
    }
    if (selected.length === 0) return next(new NoAccessError())

    try {
      const entries = parseDraftEntries(
        await completeJson<unknown>({
          system: DRAFT_SYSTEM_PROMPT,
          prompt: buildDraftPrompt(selected),
          maxTokens: 1500
        })
      )
      const listeUrl = optionalEnv('WOHNUNGEN_LISTE_URL', DEFAULT_LISTE_URL)
      return res.json({ data: renderDraft(selected, entries, listeUrl) })
    } catch (error) {
      if (error instanceof NoWohnungenError) return next(new InvalidSelectionError())
      logger.error(error, 'wohnungen-draft failed')
      return next(new DraftFailedError())
    }
  })
})
