'use client'

import { useState } from 'react'
import { useMutation } from '@apollo/client/react'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { CREATE_WOHNUNG_MUTATION, type CreateWohnungResult } from '@/graphql/wohnungen'

export interface WohnungComposerProps {
  /** Called after a flat is captured or created, so the panel can refetch. */
  onChanged: () => void
}

function optInt(value: string): number | null {
  const digits = value.replace(/[^\d]/g, '')
  return digits === '' ? null : parseInt(digits, 10)
}

function optFloat(value: string): number | null {
  const m = value.replace(',', '.').match(/-?\d+(\.\d+)?/)
  return m ? Number(m[0]) : null
}

// Two ways to add a flat by hand next to the automatic collect: paste a listing URL
// (Homegate/ImmoScout/Flatfox/cooperative → the backend fetches the page and Claude fills
// the fields — the ergonomic path for portal finds), or type the fields manually. The hook
// computes miete_pro_m2 and the criteria verdict from whatever is entered.
export function WohnungComposer({ onChanged }: WohnungComposerProps) {
  const [url, setUrl] = useState('')
  const [capturing, setCapturing] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [titel, setTitel] = useState('')
  const [adresse, setAdresse] = useState('')
  const [quartier, setQuartier] = useState('')
  const [plz, setPlz] = useState('')
  const [zimmer, setZimmer] = useState('')
  const [flaeche, setFlaeche] = useState('')
  const [miete, setMiete] = useState('')
  const [manualUrl, setManualUrl] = useState('')

  const [createWohnung, createState] = useMutation<CreateWohnungResult>(CREATE_WOHNUNG_MUTATION)

  const canCapture = /^https?:\/\//i.test(url.trim()) && !capturing

  async function capture(event: React.FormEvent) {
    event.preventDefault()
    if (!canCapture) return
    setProblem(null)
    setNotice(null)
    setCapturing(true)
    try {
      const response = await fetch('/api/wohnungen/from-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: url.trim() })
      })
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          errors?: { message?: string }[]
        } | null
        throw new Error(payload?.errors?.[0]?.message ?? `Fehler ${response.status}`)
      }
      const payload = (await response.json()) as { data?: { titel?: string } }
      setUrl('')
      setNotice(`Erfasst: ${payload.data?.titel ?? 'Wohnung'}`)
      onChanged()
    } catch (cause) {
      setProblem(messageOf(cause, 'Das Inserat konnte nicht erfasst werden.'))
    } finally {
      setCapturing(false)
    }
  }

  const canCreateManual = titel.trim() !== '' && !createState.loading

  async function createManual(event: React.FormEvent) {
    event.preventDefault()
    if (!canCreateManual) return
    setProblem(null)
    setNotice(null)
    try {
      await createWohnung({
        variables: {
          titel: titel.trim(),
          adresse: adresse.trim() || null,
          quartier: quartier.trim() || null,
          plz: plz.trim() || null,
          zimmer: optFloat(zimmer),
          flaeche_m2: optInt(flaeche),
          miete_chf: optInt(miete),
          source_url: manualUrl.trim() || null
        }
      })
      setTitel('')
      setAdresse('')
      setQuartier('')
      setPlz('')
      setZimmer('')
      setFlaeche('')
      setMiete('')
      setManualUrl('')
      setNotice('Wohnung gespeichert.')
      onChanged()
    } catch (cause) {
      setProblem(messageOf(cause, 'Die Wohnung konnte nicht gespeichert werden.'))
    }
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h2" component="h2" gutterBottom>
        Inserat per Link erfassen
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Link zu einem Inserat (Homegate, ImmoScout24, Flatfox, Genossenschaft …) einfuegen — die Felder werden
        automatisch ausgelesen.
      </Typography>

      <Stack
        component="form"
        onSubmit={capture}
        direction="row"
        spacing={1}
        sx={{ flexWrap: 'wrap', gap: 1 }}
      >
        <TextField
          label="Inserat-URL"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          fullWidth
          size="small"
          placeholder="https://…"
          sx={{ flexGrow: 1, minWidth: 240 }}
        />
        <Button
          type="submit"
          variant="contained"
          disabled={!canCapture}
          startIcon={capturing ? <CircularProgress size={16} /> : undefined}
        >
          {capturing ? 'Erfasse…' : 'Erfassen'}
        </Button>
      </Stack>

      {notice !== null && (
        <Alert severity="success" sx={{ mt: 2 }} onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}
      {problem !== null && (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setProblem(null)}>
          {problem}
        </Alert>
      )}

      <Divider sx={{ my: 2 }} />

      <Accordion
        disableGutters
        elevation={0}
        sx={{ '&:before': { display: 'none' }, bgcolor: 'transparent' }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Wohnung manuell erfassen
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 0 }}>
          <Stack component="form" onSubmit={createManual} spacing={2}>
            <TextField
              label="Titel"
              value={titel}
              onChange={(event) => setTitel(event.target.value)}
              required
              fullWidth
              size="small"
            />
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
              <TextField
                label="Adresse"
                value={adresse}
                onChange={(event) => setAdresse(event.target.value)}
                size="small"
                sx={{ flexGrow: 1, minWidth: 160 }}
              />
              <TextField
                label="Quartier"
                value={quartier}
                onChange={(event) => setQuartier(event.target.value)}
                size="small"
                sx={{ flexGrow: 1, minWidth: 120 }}
              />
              <TextField
                label="PLZ"
                value={plz}
                onChange={(event) => setPlz(event.target.value)}
                size="small"
                sx={{ width: 90 }}
              />
            </Stack>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
              <TextField
                label="Zimmer"
                value={zimmer}
                onChange={(event) => setZimmer(event.target.value)}
                size="small"
                sx={{ width: 110 }}
              />
              <TextField
                label="Flaeche (m²)"
                value={flaeche}
                onChange={(event) => setFlaeche(event.target.value)}
                size="small"
                sx={{ width: 130 }}
              />
              <TextField
                label="Miete (Fr.)"
                value={miete}
                onChange={(event) => setMiete(event.target.value)}
                size="small"
                sx={{ width: 130 }}
              />
            </Stack>
            <TextField
              label="Link (optional)"
              value={manualUrl}
              onChange={(event) => setManualUrl(event.target.value)}
              fullWidth
              size="small"
              placeholder="https://…"
            />
            <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
              <Button type="submit" variant="outlined" disabled={!canCreateManual}>
                Speichern
              </Button>
            </Stack>
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Paper>
  )
}

function messageOf(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message !== '' ? cause.message : fallback
}
