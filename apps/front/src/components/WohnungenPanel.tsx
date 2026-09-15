'use client'

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import SearchIcon from '@mui/icons-material/Search'
import Stack from '@mui/material/Stack'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import {
  UPDATE_WOHNUNG_STATUS_MUTATION,
  WOHNUNGEN_QUERY,
  type UpdateWohnungStatusResult,
  type WohnungenQueryResult
} from '@/graphql/wohnungen'
import { LIVE_FETCH_POLICY } from '@/lib/apollo'
import { SourcesManager } from './SourcesManager'
import { WohnungCard } from './WohnungCard'
import { WohnungComposer } from './WohnungComposer'
import { WohnungDraft } from './WohnungDraft'

type Filter = 'passt' | 'all' | 'neu' | 'aufgenommen' | 'im_briefing' | 'weg'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'passt', label: 'Passt' },
  { value: 'neu', label: 'Neu' },
  { value: 'aufgenommen', label: 'Uebernommen' },
  { value: 'im_briefing', label: 'Im Briefing' },
  { value: 'weg', label: 'Weg' },
  { value: 'all', label: 'Alle' }
]

function filterVariable(filter: Filter) {
  if (filter === 'all') return undefined
  if (filter === 'passt') return { ai_passt: { _eq: true }, status: { _nin: ['weg', 'verworfen'] } }
  return { status: { _eq: filter } }
}

// The one component that fetches apartments. The displayed list follows the status filter;
// the user ticks the (usually two) flats to put in the briefing and generates the box from
// exactly that selection.
export function WohnungenPanel() {
  const [filter, setFilter] = useState<Filter>('passt')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busyId, setBusyId] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ text: string; html: string; ids: string[] } | null>(null)
  const [generating, setGenerating] = useState(false)
  const [marking, setMarking] = useState(false)
  const [collecting, setCollecting] = useState(false)

  const { data, loading, error, refetch } = useQuery<WohnungenQueryResult>(WOHNUNGEN_QUERY, {
    variables: { filter: filterVariable(filter) },
    fetchPolicy: LIVE_FETCH_POLICY
  })

  const [updateStatus] = useMutation<UpdateWohnungStatusResult>(UPDATE_WOHNUNG_STATUS_MUTATION)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(
    () => () => {
      if (pollRef.current) clearInterval(pollRef.current)
    },
    []
  )

  function toggleSelect(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  async function handleStatusChange(id: string, status: string) {
    setProblem(null)
    setBusyId(id)
    try {
      await updateStatus({ variables: { id, status } })
      await refetch()
    } catch (cause) {
      setProblem(messageOf(cause, 'Der Status konnte nicht geaendert werden.'))
    } finally {
      setBusyId(null)
    }
  }

  async function handleCollect() {
    setProblem(null)
    setNotice(null)
    try {
      const response = await fetch('/api/wohnungen/collect', { method: 'POST' })
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          errors?: { message?: string }[]
        } | null
        throw new Error(payload?.errors?.[0]?.message ?? `Fehler ${response.status}`)
      }
      const payload = (await response.json()) as { data?: { running?: boolean } }
      setNotice(
        payload.data?.running === true
          ? 'Eine Suche laeuft bereits — die Liste aktualisiert sich automatisch.'
          : 'Suche gestartet — neue Wohnungen erscheinen in den naechsten Minuten automatisch.'
      )

      setCollecting(true)
      if (pollRef.current) clearInterval(pollRef.current)
      let ticks = 0
      pollRef.current = setInterval(() => {
        ticks += 1
        void refetch().catch(() => {})
        if (ticks >= 20) {
          if (pollRef.current) clearInterval(pollRef.current)
          pollRef.current = null
          setCollecting(false)
          setNotice('Suche abgeschlossen. Alle neuen Wohnungen sind jetzt in der Liste.')
        }
      }, 15000)
    } catch (cause) {
      setProblem(messageOf(cause, 'Die Suche nach neuen Wohnungen konnte nicht gestartet werden.'))
      setCollecting(false)
    }
  }

  async function handleGenerate() {
    setProblem(null)
    setGenerating(true)
    try {
      const ids = [...selected]
      const response = await fetch('/api/wohnungen/draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids })
      })
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          errors?: { message?: string }[]
        } | null
        throw new Error(payload?.errors?.[0]?.message ?? `Fehler ${response.status}`)
      }
      const payload = (await response.json()) as { data?: { text?: string; html?: string } }
      setDraft({ text: payload.data?.text ?? '', html: payload.data?.html ?? '', ids })
    } catch (cause) {
      setProblem(messageOf(cause, 'Der Wohnungs-Text konnte nicht erzeugt werden.'))
    } finally {
      setGenerating(false)
    }
  }

  // Move the used flats to "im Briefing" once the box has been generated, so they are not
  // offered again next week.
  async function handleMark() {
    if (draft === null) return
    setProblem(null)
    setMarking(true)
    try {
      for (const id of draft.ids) {
        await updateStatus({ variables: { id, status: 'im_briefing' } })
      }
      await refetch()
      setSelected(new Set())
      setDraft(null)
      setNotice(
        `${draft.ids.length} Wohnung${draft.ids.length === 1 ? '' : 'en'} als «im Briefing» markiert.`
      )
    } catch (cause) {
      setProblem(messageOf(cause, 'Die Wohnungen konnten nicht markiert werden.'))
    } finally {
      setMarking(false)
    }
  }

  const wohnungen = data?.wohnungen ?? []
  const selectedCount = selected.size

  return (
    <Stack spacing={2}>
      <WohnungComposer onChanged={() => void refetch()} />

      <SourcesManager collector="wohnungen" />

      <Stack
        direction="row"
        spacing={2}
        sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}
      >
        <ToggleButtonGroup
          size="small"
          exclusive
          value={filter}
          onChange={(_event, value: Filter | null) => value !== null && setFilter(value)}
        >
          {FILTERS.map(({ value, label }) => (
            <ToggleButton key={value} value={value}>
              {label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Button
            variant="outlined"
            disabled={collecting}
            startIcon={collecting ? <CircularProgress size={16} /> : <SearchIcon />}
            onClick={handleCollect}
          >
            {collecting ? 'Suche laeuft…' : 'Jetzt sammeln'}
          </Button>
          <Button
            variant="contained"
            disabled={selectedCount === 0 || generating}
            startIcon={generating ? <CircularProgress size={16} /> : undefined}
            onClick={handleGenerate}
          >
            Briefing-Text generieren ({selectedCount})
          </Button>
        </Stack>
      </Stack>

      {notice !== null && (
        <Alert severity="info" onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      {problem !== null && (
        <Alert severity="error" onClose={() => setProblem(null)}>
          {problem}
        </Alert>
      )}

      {draft !== null && (
        <WohnungDraft
          text={draft.text}
          html={draft.html}
          count={draft.ids.length}
          marking={marking}
          onMark={handleMark}
          onClose={() => setDraft(null)}
        />
      )}

      {error !== undefined && (
        <Alert severity="error">Wohnungen konnten nicht geladen werden: {error.message}</Alert>
      )}

      {loading && wohnungen.length === 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && wohnungen.length === 0 && error === undefined && (
        <Typography color="text.secondary">Keine Wohnungen in dieser Ansicht.</Typography>
      )}

      {wohnungen.map((wohnung) => (
        <WohnungCard
          key={wohnung.id}
          wohnung={wohnung}
          busy={busyId === wohnung.id}
          selected={selected.has(wohnung.id)}
          onSelect={toggleSelect}
          onStatusChange={handleStatusChange}
        />
      ))}
    </Stack>
  )
}

function messageOf(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message !== '' ? cause.message : fallback
}
