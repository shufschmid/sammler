import { proxyToDirectus, problem } from '@/lib/proxy.server'

// POST /api/wohnungen/draft
//
// Calls the `wohnungen-draft` endpoint of the Directus extension bundle, which writes the
// "Günstige Wohnungen in Basel" box in the verified house style. The Claude call and the
// prompt live there — this route only validates the selection and carries the token across.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { ids?: unknown } | null
  const ids = Array.isArray(body?.ids)
    ? body.ids.filter((id): id is string => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id))
    : []

  if (ids.length === 0) return problem(400, 'Keine gueltigen Wohnungen ausgewaehlt.')

  return proxyToDirectus('/wohnungen-draft', {
    method: 'POST',
    body: JSON.stringify({ ids })
  })
}
