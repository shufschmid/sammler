import { createError } from '@directus/errors'
import { defineEndpoint } from '@directus/extensions-sdk'
import type { NextFunction, Response } from 'express'
import { isAuthenticated, type ApiRequest } from '../../shared/http'
import {
  runWohnungenCollect,
  type RunContext,
  type WohnungCollectSummary
} from './run'

// POST /wohnungen-collect — manually trigger an apartment collect run (panel button).
// GET  /wohnungen-collect — status of the last run, for diagnosis.
// Also driven weekly by a Schedule Flow via the wohnungen-collect operation.
//
// Same shape as offers-collect: 202 immediately + fire-and-forget (a full run scrapes ~25
// sources and takes minutes), with a `running` guard and last-run state for GET.

const NotSignedInError = createError('FORBIDDEN', 'Anmeldung erforderlich.', 401)

const DEFAULT_COLLECT_LIMIT = 40

let running = false
let startedAt: string | null = null
let finishedAt: string | null = null
let lastSummary: WohnungCollectSummary | null = null
let lastError: string | null = null

export default defineEndpoint((router, context) => {
  router.get('/', (req: ApiRequest, res: Response, next: NextFunction) => {
    if (!isAuthenticated(req)) return next(new NotSignedInError())
    return res.json({
      data: { running, startedAt, finishedAt, lastSummary, lastError }
    })
  })

  router.post('/', async (req: ApiRequest, res: Response, next: NextFunction) => {
    if (!isAuthenticated(req)) return next(new NotSignedInError())

    if (running) {
      return res.status(202).json({ data: { started: false, running: true } })
    }

    running = true
    startedAt = new Date().toISOString()
    lastError = null
    void runWohnungenCollect(
      { collectLimit: DEFAULT_COLLECT_LIMIT },
      context as unknown as RunContext
    )
      .then((summary) => {
        lastSummary = summary
        context.logger.info(summary, 'wohnungen-collect run finished')
      })
      .catch((error) => {
        lastError = error instanceof Error ? error.message : String(error)
        context.logger.error(error, 'wohnungen-collect run failed')
      })
      .finally(() => {
        running = false
        finishedAt = new Date().toISOString()
      })

    return res.status(202).json({ data: { started: true } })
  })
})
