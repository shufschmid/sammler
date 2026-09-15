'use client'

import Box from '@mui/material/Box'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import Link from '@mui/material/Link'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { WohnungFields } from '@/graphql/wohnungen'
import {
  fit,
  formatChf,
  formatDate,
  formatFlaeche,
  formatMieteProM2,
  formatZimmer,
  sourceLabel,
  statusLabel,
  WOHNUNG_STATUSES
} from '@/lib/wohnungen'

export interface WohnungCardProps {
  wohnung: WohnungFields
  busy: boolean
  selected: boolean
  onSelect: (id: string, selected: boolean) => void
  onStatusChange: (id: string, status: string) => void
}

const FIT_COLOR = {
  pass: 'success',
  warn: 'warning',
  fail: 'error'
} as const

// Presentational: props in, callbacks out, no data fetching. Shows the fields the briefing
// box needs (rooms, m², rent, rent/m², quartier) plus the computed criteria verdict and a
// checkbox to pick the (usually two) flats a draft is generated from.
export function WohnungCard({ wohnung, busy, selected, onSelect, onStatusChange }: WohnungCardProps) {
  const verdict = fit(wohnung.ai_passt, wohnung.ai_passt_grund)

  return (
    <Paper sx={{ p: 2, opacity: wohnung.ai_passt === false ? 0.7 : 1 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
        <Checkbox
          checked={selected}
          disabled={busy}
          onChange={(event) => onSelect(wohnung.id, event.target.checked)}
          sx={{ mt: -0.5, ml: -1 }}
          slotProps={{ input: { 'aria-label': `${wohnung.titel} fuer Briefing auswaehlen` } }}
        />
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Stack direction="row" spacing={0.5} sx={{ mb: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
            <Chip label={sourceLabel(wohnung.source)} size="small" variant="outlined" />
            {wohnung.ai_genossenschaft === true && <Chip label="Genossenschaft" size="small" color="info" />}
            {verdict !== null && (
              <Tooltip title={wohnung.ai_passt_grund ?? ''}>
                <Chip label={verdict.label} size="small" color={FIT_COLOR[verdict.tone]} />
              </Tooltip>
            )}
          </Stack>

          <Typography variant="h2" component="h3" sx={{ wordBreak: 'break-word' }}>
            {wohnung.titel}
          </Typography>

          {(wohnung.adresse !== null || wohnung.quartier !== null) && (
            <Typography variant="body2" color="text.secondary">
              {[wohnung.adresse, wohnung.quartier].filter(Boolean).join(' · ')}
            </Typography>
          )}

          <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
            <Chip label={formatZimmer(wohnung.zimmer)} size="small" variant="outlined" />
            <Chip label={formatFlaeche(wohnung.flaeche_m2)} size="small" variant="outlined" />
            <Chip label={formatChf(wohnung.miete_chf)} size="small" variant="outlined" />
            <Chip label={formatMieteProM2(wohnung.miete_pro_m2)} size="small" variant="outlined" />
          </Stack>

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            {wohnung.listed_at !== null
              ? `Inseriert: ${formatDate(wohnung.listed_at)}`
              : `Gefunden: ${formatDate(wohnung.date_created)}`}
          </Typography>

          {wohnung.source_url !== null && (
            <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
              <Link href={wohnung.source_url} target="_blank" rel="noopener noreferrer">
                Zum Inserat
              </Link>
            </Typography>
          )}
        </Box>

        <TextField
          select
          size="small"
          label="Status"
          value={wohnung.status}
          disabled={busy}
          onChange={(event) => onStatusChange(wohnung.id, event.target.value)}
          sx={{ flexShrink: 0, minWidth: 150 }}
        >
          {WOHNUNG_STATUSES.map((status) => (
            <MenuItem key={status} value={status}>
              {statusLabel(status)}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
    </Paper>
  )
}
