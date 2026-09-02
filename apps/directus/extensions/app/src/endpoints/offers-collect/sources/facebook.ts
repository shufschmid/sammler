import { absoluteUrl, extractLinks } from './markdown'
import type { Candidate, SourceAdapter } from './types'

// Facebook group «Rund um d'Fasnacht Basel & Regio» — best-effort only. Anonymously
// (and this crawler is anonymous) Facebook serves a login wall with at most the pinned
// posts, so discovery usually finds nothing; that is not an error — the operation logs
// the count and moves on, and the redaction adds group finds by hand in the panel.
//
// When the rendered page does surface post permalinks, each becomes a candidate keyed
// by its post id. force_playwright is required either way.

export const FACEBOOK_GROUP_ID = '457616777678107'
export const FACEBOOK_GROUP_URL = `https://www.facebook.com/groups/${FACEBOOK_GROUP_ID}`

// facebook.com/groups/<id>/posts/<postId> or /permalink/<postId> or /groups/<id>/permalink/<postId>
const POST_ID =
  /facebook\.com\/(?:groups\/\d+\/posts|permalink|groups\/\d+\/permalink)\/(\d+)/i

/** Extracts any post permalinks from the group page's Markdown. Often empty. */
export function discover(markdown: string): Candidate[] {
  const seen = new Set<string>()
  const candidates: Candidate[] = []

  for (const link of extractLinks(markdown)) {
    const url = absoluteUrl(link.url, FACEBOOK_GROUP_URL)
    if (url === null) continue

    const match = url.match(POST_ID)
    const postId = match?.[1]
    if (postId === undefined || seen.has(postId)) continue
    seen.add(postId)

    candidates.push({
      source: 'facebook',
      sourceId: postId,
      sourceUrl: `${FACEBOOK_GROUP_URL}/posts/${postId}`,
      needsPlaywright: true
    })
  }

  return candidates
}

export const facebookAdapter: SourceAdapter = {
  source: 'facebook',
  entryUrls: [FACEBOOK_GROUP_URL],
  needsPlaywrightForEntry: true,
  discover
}
