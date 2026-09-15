'use client'

import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

export interface WohnungDraftProps {
  text: string
  /** The box as HTML — the "X-Zimmer-Wohnung" phrases are clickable links. */
  html: string
  /** How many flats this draft covers — marked "im Briefing" on confirmation. */
  count: number
  marking: boolean
  onMark: () => void
  onClose: () => void
}

// Presentational: shows the generated "Günstige Wohnungen in Basel" box as a rich preview
// and copies it as HTML, so pasting into the newsletter editor keeps the hyperlinks.
// "Als im Briefing markieren" moves the covered flats to the im_briefing status.
export function WohnungDraft({ text, html, count, marking, onMark, onClose }: WohnungDraftProps) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      const clip = window.ClipboardItem
      if (navigator.clipboard && typeof clip === 'function') {
        await navigator.clipboard.write([
          new clip({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([text], { type: 'text/plain' })
          })
        ])
      } else {
        await navigator.clipboard.writeText(text)
      }
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Paper sx={{ p: 2, borderColor: 'primary.main', borderWidth: 1, borderStyle: 'solid' }}>
      <Typography variant="h2" component="h2" gutterBottom>
        Wohnungs-Entwurf
      </Typography>
      <Typography variant="caption" color="text.secondary">
        Vorschau — «Kopieren» uebernimmt den Text inklusive verlinkter Wohnungen ins Briefing.
      </Typography>
      <Box
        aria-label="Generierter Wohnungs-Text"
        sx={{
          mt: 1,
          p: 1.5,
          borderRadius: 1,
          bgcolor: 'action.hover',
          '& p': { m: 0, mb: 1 },
          '& a': { color: 'primary.main' }
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: 'flex-end', flexWrap: 'wrap', gap: 1 }}>
        <Button onClick={onClose}>Schliessen</Button>
        <Button variant="outlined" disabled={marking || count === 0} onClick={onMark}>
          Als im Briefing markieren ({count})
        </Button>
        <Button variant="contained" onClick={copy}>
          {copied ? 'Kopiert' : 'Kopieren'}
        </Button>
      </Stack>
    </Paper>
  )
}
