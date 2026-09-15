import { defineHook } from '@directus/extensions-sdk'
import { normalizeWohnungPayload, type WohnungPayload } from './normalize'

// Trims the text fields and computes miete_pro_m2 + ai_passt/ai_passt_grund from the
// criteria on every write path. `filter` runs before the write and returns the payload.
export default defineHook(({ filter }) => {
  filter('wohnungen.items.create', (payload) =>
    normalizeWohnungPayload(payload as WohnungPayload, true)
  )
  filter('wohnungen.items.update', (payload) =>
    normalizeWohnungPayload(payload as WohnungPayload, false)
  )
})
