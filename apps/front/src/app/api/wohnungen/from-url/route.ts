import { proxyToDirectus, problem } from '@/lib/proxy.server'

// POST /api/wohnungen/from-url
//
// "Inserat per Link erfassen": forwards a listing URL to the `wohnungen-from-url` endpoint,
// which fetches the page and lets Claude fill the fields. Thin proxy — the crawler call and
// the extraction live in the backend.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { url?: unknown } | null
  const url = typeof body?.url === 'string' ? body.url.trim() : ''

  if (!/^https?:\/\//i.test(url)) return problem(400, 'Bitte eine gueltige http(s)-URL angeben.')

  return proxyToDirectus('/wohnungen-from-url', {
    method: 'POST',
    body: JSON.stringify({ url })
  })
}
