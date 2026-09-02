'use client'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Link from '@mui/material/Link'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import type { OfferFields } from '@/graphql/offers'
import { categoryLabel, formatDate, OFFER_STATUSES, recency, sourceLabel, statusLabel } from '@/lib/offers'

export interface OfferCardProps {
  offer: OfferFields
  busy: boolean
  onStatusChange: (id: string, status: string) => void
}

const RECENCY_COLOR = {
  fresh: 'success',
  evergreen: 'info',
  stale: 'default'
} as const

// Presentational: props in, callbacks out, no data fetching. Shows what the backend
// stored (summary and category live in their own fields) plus a status selector.
export function OfferCard({ offer, busy, onStatusChange }: OfferCardProps) {
  const summary = offer.ai_summary === null || offer.ai_summary.trim() === '' ? null : offer.ai_summary
  const category = categoryLabel(offer.ai_category)
  const freshness = recency(offer.listed_at, offer.ai_evergreen)

  return (
    <Paper sx={{ p: 2 }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} sx={{ mb: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
            <Chip label={sourceLabel(offer.source)} size="small" variant="outlined" />
            {category !== null && <Chip label={category} size="small" color="primary" />}
            {freshness !== null && (
              <Chip label={freshness.label} size="small" color={RECENCY_COLOR[freshness.tone]} />
            )}
          </Stack>
          <Typography variant="h2" component="h3" sx={{ wordBreak: 'break-word' }}>
            {offer.title}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {offer.listed_at !== null
              ? `Inseriert: ${formatDate(offer.listed_at)}`
              : `Gefunden: ${formatDate(offer.date_created)}`}
          </Typography>
        </Box>

        <TextField
          select
          size="small"
          label="Status"
          value={offer.status}
          disabled={busy}
          onChange={(event) => onStatusChange(offer.id, event.target.value)}
          sx={{ flexShrink: 0, minWidth: 150 }}
        >
          {OFFER_STATUSES.map((status) => (
            <MenuItem key={status} value={status}>
              {statusLabel(status)}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {summary !== null && (
        <Box sx={{ mt: 2, p: 1.5, borderRadius: 1, bgcolor: 'action.hover' }}>
          <Typography variant="overline" color="text.secondary">
            Ticker-Vorschlag von Claude
          </Typography>
          <Typography variant="body2">{summary}</Typography>
          {offer.ai_audience !== null && offer.ai_audience.trim() !== '' && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              Zielgruppe: {offer.ai_audience}
            </Typography>
          )}
        </Box>
      )}

      {offer.contact !== null && offer.contact.trim() !== '' && (
        <Typography variant="body2" sx={{ mt: 1.5 }}>
          Kontakt: {offer.contact}
        </Typography>
      )}

      {offer.source_url !== null && (
        <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
          <Link href={offer.source_url} target="_blank" rel="noopener noreferrer">
            Zum Original
          </Link>
        </Typography>
      )}
    </Paper>
  )
}
