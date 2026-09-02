import { defineHook } from '@directus/extensions-sdk'
import { normalizeOfferPayload, type OfferPayload } from './normalize'

// Keeps the offers collection tidy on every write path (admin UI, GraphQL, the collect
// operation): trims the human fields, and invalidates the AI classification when the
// source text changes so a stale summary cannot outlive it.
//
// `filter` runs before the write and returns the payload — the only place that can
// still change what gets stored. Long work (the reclassification itself) belongs in the
// Flow, not here; a hook blocks the request.
export default defineHook(({ filter }) => {
  filter('offers.items.create', (payload) =>
    normalizeOfferPayload(payload as OfferPayload)
  )
  filter('offers.items.update', (payload) =>
    normalizeOfferPayload(payload as OfferPayload)
  )
})
