'use client'

import { useState } from 'react'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

export interface OfferComposerProps {
  busy: boolean
  onCreate: (offer: { title: string; raw_text: string; contact: string }) => Promise<void>
}

// Manual entry for finds that cannot be scraped: Facebook posts and reader emails. The
// collect Flow classifies the entry (category, ticker summary) on its next run.
export function OfferComposer({ busy, onCreate }: OfferComposerProps) {
  const [title, setTitle] = useState('')
  const [rawText, setRawText] = useState('')
  const [contact, setContact] = useState('')

  const canSubmit = title.trim() !== '' && !busy

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit) return

    await onCreate({ title: title.trim(), raw_text: rawText.trim(), contact: contact.trim() })
    setTitle('')
    setRawText('')
    setContact('')
  }

  return (
    <Paper component="form" onSubmit={submit} sx={{ p: 2 }}>
      <Typography variant="h2" component="h2" gutterBottom>
        Inserat manuell erfassen
      </Typography>
      <Stack spacing={2}>
        <TextField
          label="Titel"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          fullWidth
          size="small"
        />
        <TextField
          label="Text"
          value={rawText}
          onChange={(event) => setRawText(event.target.value)}
          multiline
          minRows={3}
          fullWidth
          size="small"
        />
        <TextField
          label="Kontakt"
          value={contact}
          onChange={(event) => setContact(event.target.value)}
          fullWidth
          size="small"
        />
        <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
          <Button type="submit" variant="contained" disabled={!canSubmit}>
            Speichern
          </Button>
        </Stack>
      </Stack>
    </Paper>
  )
}
