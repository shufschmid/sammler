'use client'

import { useState } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import {
  CREATE_QUELLE_MUTATION,
  DELETE_QUELLE_MUTATION,
  QUELLEN_QUERY,
  UPDATE_QUELLE_ACTIVE_MUTATION,
  type CreateQuelleResult,
  type DeleteQuelleResult,
  type QuellenQueryResult,
  type UpdateQuelleResult
} from '@/graphql/quellen'
import { LIVE_FETCH_POLICY } from '@/lib/apollo'

// Lets the redaction register extra sources (a URL with listings) that the collect run
// searches. Self-contained: its own queries/mutations, rendered below the AppShell gate
// so nothing runs during SSR.
export function SourcesManager() {
  const { data, refetch } = useQuery<QuellenQueryResult>(QUELLEN_QUERY, {
    fetchPolicy: LIVE_FETCH_POLICY
  })
  const [createQuelle, createState] = useMutation<CreateQuelleResult>(CREATE_QUELLE_MUTATION)
  const [updateActive] = useMutation<UpdateQuelleResult>(UPDATE_QUELLE_ACTIVE_MUTATION)
  const [deleteQuelle] = useMutation<DeleteQuelleResult>(DELETE_QUELLE_MUTATION)

  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [needsPlaywright, setNeedsPlaywright] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const quellen = data?.quellen ?? []
  const canSubmit = name.trim() !== '' && /^https?:\/\//i.test(url.trim()) && !createState.loading

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    setProblem(null)
    try {
      await createQuelle({
        variables: { name: name.trim(), url: url.trim(), needs_playwright: needsPlaywright }
      })
      setName('')
      setUrl('')
      setNeedsPlaywright(false)
      await refetch()
    } catch (cause) {
      setProblem(messageOf(cause, 'Die Quelle konnte nicht gespeichert werden.'))
    }
  }

  async function toggle(id: string, active: boolean) {
    setProblem(null)
    try {
      await updateActive({ variables: { id, active } })
      await refetch()
    } catch (cause) {
      setProblem(messageOf(cause, 'Die Quelle konnte nicht geaendert werden.'))
    }
  }

  async function remove(id: string) {
    setProblem(null)
    try {
      await deleteQuelle({ variables: { id } })
      await refetch()
    } catch (cause) {
      setProblem(messageOf(cause, 'Die Quelle konnte nicht geloescht werden.'))
    }
  }

  return (
    <Accordion disableGutters sx={{ '&:before': { display: 'none' } }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="h2" component="h2">
          Quellen verwalten {quellen.length > 0 && `(${quellen.length})`}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Zusaetzliche Seiten mit Inseraten/Angeboten, die bei «Inserate suchen» mitdurchsucht werden.
          </Typography>

          <Stack component="form" onSubmit={submit} spacing={2}>
            <TextField
              label="Name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              fullWidth
              size="small"
            />
            <TextField
              label="URL"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              required
              fullWidth
              size="small"
              placeholder="https://…"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={needsPlaywright}
                  onChange={(event) => setNeedsPlaywright(event.target.checked)}
                />
              }
              label="Seite laedt Inhalte erst per JavaScript"
            />
            <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
              <Button type="submit" variant="contained" disabled={!canSubmit}>
                Quelle hinzufuegen
              </Button>
            </Stack>
          </Stack>

          {problem !== null && (
            <Alert severity="error" onClose={() => setProblem(null)}>
              {problem}
            </Alert>
          )}

          {quellen.length > 0 && <Divider />}

          <Stack spacing={1}>
            {quellen.map((quelle) => (
              <Stack
                key={quelle.id}
                direction="row"
                spacing={1}
                sx={{ alignItems: 'center', justifyContent: 'space-between' }}
              >
                <div style={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {quelle.name}
                  </Typography>
                  <Link
                    href={quelle.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="caption"
                    sx={{ wordBreak: 'break-all' }}
                  >
                    {quelle.url}
                  </Link>
                </div>
                <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', flexShrink: 0 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={quelle.active}
                        onChange={(event) => toggle(quelle.id, event.target.checked)}
                      />
                    }
                    label="Aktiv"
                  />
                  <IconButton
                    size="small"
                    color="error"
                    aria-label={`Quelle ${quelle.name} loeschen`}
                    onClick={() => remove(quelle.id)}
                  >
                    <DeleteOutlinedIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Stack>
            ))}
          </Stack>
        </Stack>
      </AccordionDetails>
    </Accordion>
  )
}

function messageOf(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message !== '' ? cause.message : fallback
}
