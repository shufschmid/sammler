import { defineOperationApi } from '@directus/extensions-sdk'
import { recompute, REEVALUATE_FIELDS, type WohnungRow } from './reevaluate'

// Re-runs the criteria over the stored apartments. The hook computes `miete_pro_m2`,
// `ai_passt` and `ai_passt_grund` only when a row is written, and a collect run skips
// known listings (dedup on source_url) — so after changing a threshold in criteria.ts the
// existing rows keep their old verdict. Hang this on a manual Flow and click it once.
//
// Bounded (`limit`), idempotent (rows that already match are skipped, not rewritten), and
// one failing row is logged and skipped rather than aborting the batch.

export interface Options {
  limit: number
}

interface WohnungenService {
  readByQuery(query: unknown): Promise<unknown>
  updateOne(key: string, data: unknown): Promise<unknown>
}

interface OperationContext {
  services: {
    ItemsService: new (collection: string, options: unknown) => WohnungenService
  }
  getSchema: () => Promise<unknown>
  logger: {
    warn: (...args: unknown[]) => void
    info: (...args: unknown[]) => void
  }
}

export interface ReevaluateSummary {
  checked: number
  updated: number
  unchanged: number
  errors: string[]
}

const MAX_ERRORS = 8

export default defineOperationApi<Options>({
  id: 'wohnungen-reevaluate',
  handler: async ({ limit }, context) => {
    const { services, getSchema, logger } =
      context as unknown as OperationContext
    const wohnungen = new services.ItemsService('wohnungen', {
      schema: await getSchema()
    })

    const rows = (await wohnungen.readByQuery({
      limit: limit ?? 1000,
      fields: REEVALUATE_FIELDS
    })) as WohnungRow[]

    const summary: ReevaluateSummary = {
      checked: 0,
      updated: 0,
      unchanged: 0,
      errors: []
    }

    for (const row of rows) {
      summary.checked += 1
      const next = recompute(row)
      if (next === null) {
        summary.unchanged += 1
        continue
      }
      try {
        // Only the three criteria columns — the normalize hook leaves them alone because
        // the payload carries neither miete_chf nor flaeche_m2.
        await wohnungen.updateOne(row.id, next)
        summary.updated += 1
      } catch (error) {
        if (summary.errors.length < MAX_ERRORS) {
          summary.errors.push(
            `${row.id}: ${error instanceof Error ? error.message : String(error)}`
          )
        }
        logger.warn(error, `wohnungen-reevaluate: could not update ${row.id}`)
      }
    }

    logger.info(summary, 'wohnungen-reevaluate finished')
    return summary
  }
})
