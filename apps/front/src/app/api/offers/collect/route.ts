import { proxyToDirectus } from '@/lib/proxy.server'

// POST /api/offers/collect
//
// Triggers a collection run in the Directus extension (`offers-collect` endpoint):
// scrape the public sources, store and classify new Fasnacht offers. Thin proxy — all
// the logic lives in the backend.
export async function POST() {
  return proxyToDirectus('/offers-collect', { method: 'POST' })
}
