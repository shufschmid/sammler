import { proxyToDirectus, problem } from '@/lib/proxy.server'

// POST /api/vermittlungsbuero/draft
//
// Calls the `vermittlungsbuero-draft` endpoint of the Directus extension bundle. The
// Claude call and the prompt live there — this route only validates the selection and
// carries the request across with the user's token.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { ids?: unknown } | null
  const ids = Array.isArray(body?.ids)
    ? body.ids.filter((id): id is string => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id))
    : []

  if (ids.length === 0) return problem(400, 'Keine gueltigen Inserate ausgewaehlt.')

  // A string body: proxyToDirectus replays the request after a token refresh.
  return proxyToDirectus('/vermittlungsbuero-draft', {
    method: 'POST',
    body: JSON.stringify({ ids })
  })
}
