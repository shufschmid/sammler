import type { OfferSource } from '../../../types/schema'
import { facebookAdapter } from './facebook'
import { fasnachtchAdapter } from './fasnachtch'
import { fraufasnachtAdapter } from './fraufasnacht'
import type { SourceAdapter } from './types'
import { unimarktAdapter } from './unimarkt'

// Every automatable source, in the order the operation scans them. `manual` has no
// adapter — those offers are typed into the panel.
export const ALL_ADAPTERS: SourceAdapter[] = [
  fraufasnachtAdapter,
  unimarktAdapter,
  fasnachtchAdapter,
  facebookAdapter
]

/**
 * Selects the adapters named in the Flow options. An unknown or empty selection means
 * "all" — the safe default for a scheduled job whose options were left untouched.
 */
export function adaptersFor(
  names: readonly string[] | undefined
): SourceAdapter[] {
  if (names === undefined || names.length === 0) return ALL_ADAPTERS

  const wanted = new Set<OfferSource>(names as OfferSource[])
  const selected = ALL_ADAPTERS.filter((adapter) => wanted.has(adapter.source))
  return selected.length === 0 ? ALL_ADAPTERS : selected
}

export type { Candidate, SourceAdapter } from './types'
