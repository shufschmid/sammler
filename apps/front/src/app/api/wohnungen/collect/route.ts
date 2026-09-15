import { proxyToDirectus } from '@/lib/proxy.server'

// POST /api/wohnungen/collect
//
// Triggers an apartment collection run in the Directus extension (`wohnungen-collect`):
// scrape the cooperative/Unimarkt/Immobilien-BS sources, read newsletter mail over IMAP,
// store and evaluate new flats. Thin proxy — all logic lives in the backend.
export async function POST() {
  return proxyToDirectus('/wohnungen-collect', { method: 'POST' })
}

// GET /api/wohnungen/collect — status of the last run, for diagnosis.
export async function GET() {
  return proxyToDirectus('/wohnungen-collect', { method: 'GET' })
}
