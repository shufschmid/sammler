'use client'

import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

export interface TickerDraftProps {
  text: string
  /** The ticker as HTML — the source names are clickable links. */
  html: string
  /** How many offers this draft covers — marked published on confirmation. */
  count: number
  publishing: boolean
  onPublish: () => void
  onClose: () => void
}

// Presentational: shows the generated Vermittlungsbüro paragraph as a rich preview (the
// source names are clickable) and copies it as HTML, so pasting into an email keeps the
// hyperlinks. "Als veröffentlicht markieren" moves the covered offers out of the pool.
export function TickerDraft({ text, html, count, publishing, onPublish, onClose }: TickerDraftProps) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      // Write both HTML and plain text so the email client takes the rich version and
      // everything else still gets a usable fallback with the URLs spelled out.
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
        Vermittlungsbuero-Entwurf
      </Typography>
      <Typography variant="caption" color="text.secondary">
        Vorschau — «Kopieren» uebernimmt den Text inklusive verlinkter Quellen ins E-Mail.
      </Typography>
      <Box
        aria-label="Generierter Vermittlungsbuero-Text"
        sx={{
          mt: 1,
          p: 1.5,
          borderRadius: 1,
          bgcolor: 'action.hover',
          '& p': { m: 0 },
          '& a': { color: 'primary.main' }
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: 'flex-end', flexWrap: 'wrap', gap: 1 }}>
        <Button onClick={onClose}>Schliessen</Button>
        <Button variant="outlined" disabled={publishing || count === 0} onClick={onPublish}>
          Als veroeffentlicht markieren ({count})
        </Button>
        <Button variant="contained" onClick={copy}>
          {copied ? 'Kopiert' : 'Kopieren'}
        </Button>
      </Stack>
    </Paper>
  )
}
