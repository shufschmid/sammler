import { defineOperationApi } from '@directus/extensions-sdk'
import { runWohnungenCollect, type RunContext } from '../../endpoints/wohnungen-collect/run'

// Scheduled apartment collect. Wired to a Directus Flow with a Schedule (cron) trigger —
// weekly Tuesday 12:30 (see the Flow in schema/). Shares runWohnungenCollect with the
// panel button, so both do exactly the same thing. Bounded and idempotent.

export interface Options {
  collectLimit: number
  model?: string | null
}

export default defineOperationApi<Options>({
  id: 'wohnungen-weekly',
  handler: async ({ collectLimit, model }, context) => {
    const summary = await runWohnungenCollect(
      { collectLimit: collectLimit ?? 40, ...(model ? { model } : {}) },
      context as unknown as RunContext
    )
    return summary
  }
})
