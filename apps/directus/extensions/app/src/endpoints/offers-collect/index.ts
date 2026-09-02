import { createError } from '@directus/errors'
import { defineEndpoint } from '@directus/extensions-sdk'
import type { NextFunction, Response } from 'express'
import { isAuthenticated, type ApiRequest } from '../../shared/http'
import { runCollect, type RunContext } from './run'

// POST /offers-collect
//
// Manually triggers a collection run: scrapes the public sources through the crawler,
// stores new Fasnacht offers and classifies them. This replaces the scheduled Flow —
// the redaction starts a run from a button in the panel when they want fresh offers.
//
// The run is kicked off and the request returns 202 immediately, because a full run
// (Playwright-rendered sources plus one Claude call per candidate) takes minutes — far
// longer than an HTTP request should be held open. Offers are written incrementally, so
// the panel just polls the list and they appear as they are found. Bounded so one click
// cannot spiral into an open-ended crawl.

const NotSignedInError = createError(
  'FORBIDDEN',
  'Anmeldung erforderlich.',
  401
)

const DEFAULT_COLLECT_LIMIT = 20
const DEFAULT_CLASSIFY_LIMIT = 15

// Guard against overlapping runs: a second click while one is still working is a no-op.
let running = false

export default defineEndpoint((router, context) => {
  router.post(
    '/',
    async (req: ApiRequest, res: Response, next: NextFunction) => {
      if (!isAuthenticated(req)) return next(new NotSignedInError())

      if (running) {
        return res.status(202).json({ data: { started: false, running: true } })
      }

      running = true
      // Fire-and-forget: Directus is a long-lived process, so the run keeps going after
      // the response. Never reference req/res inside — they are done once we answer.
      void runCollect(
        {
          collectLimit: DEFAULT_COLLECT_LIMIT,
          classifyLimit: DEFAULT_CLASSIFY_LIMIT
        },
        context as unknown as RunContext
      )
        .then((summary) =>
          context.logger.info(summary, 'offers-collect run finished')
        )
        .catch((error) =>
          context.logger.error(error, 'offers-collect run failed')
        )
        .finally(() => {
          running = false
        })

      return res.status(202).json({ data: { started: true } })
    }
  )
})
