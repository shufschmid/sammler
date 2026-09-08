import { createError } from '@directus/errors'
import { defineEndpoint } from '@directus/extensions-sdk'
import type { NextFunction, Response } from 'express'
import { isAuthenticated, type ApiRequest } from '../../shared/http'
import { runCollect, type CollectSummary, type RunContext } from './run'

// POST /offers-collect — manually trigger a collection run (the panel's "Inserate suchen"
// button). GET /offers-collect — read the status of the last run for diagnosis.
//
// The run is kicked off and POST returns 202 immediately, because a full run (Playwright-
// rendered sources plus one Claude call per candidate) takes minutes — far longer than an
// HTTP request should be held open. Offers are written incrementally, so the panel just
// polls the list and they appear as they are found. Bounded so one click cannot spiral
// into an open-ended crawl.

const NotSignedInError = createError('FORBIDDEN', 'Anmeldung erforderlich.', 401)

const DEFAULT_COLLECT_LIMIT = 20
const DEFAULT_CLASSIFY_LIMIT = 15

// Run state kept in the process so GET can report what happened (there is no place to
// return the summary from a fire-and-forget POST). Enough to diagnose a run without logs.
let running = false
let startedAt: string | null = null
let finishedAt: string | null = null
let lastSummary: CollectSummary | null = null
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
    // Fire-and-forget: Directus is a long-lived process, so the run keeps going after the
    // response. Never reference req/res inside — they are done once we answer.
    void runCollect(
      { collectLimit: DEFAULT_COLLECT_LIMIT, classifyLimit: DEFAULT_CLASSIFY_LIMIT },
      context as unknown as RunContext
    )
      .then((summary) => {
        lastSummary = summary
        context.logger.info(summary, 'offers-collect run finished')
      })
      .catch((error) => {
        lastError = error instanceof Error ? error.message : String(error)
        context.logger.error(error, 'offers-collect run failed')
      })
      .finally(() => {
        running = false
        finishedAt = new Date().toISOString()
      })

    return res.status(202).json({ data: { started: true } })
  })
})
