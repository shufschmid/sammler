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
  CREATE_OFFER_MUTATION,
  OFFERS_QUERY,
  UPDATE_OFFER_STATUS_MUTATION,
  type CreateOfferResult,
  type OffersQueryResult,
  type UpdateOfferStatusResult
} from '@/graphql/offers'
import { LIVE_FETCH_POLICY } from '@/lib/apollo'
import { statusLabel } from '@/lib/offers'
import { OfferCard } from './OfferCard'
import { OfferComposer } from './OfferComposer'
import { SourcesManager } from './SourcesManager'
import { TickerDraft } from './TickerDraft'

type Filter = 'all' | 'new' | 'reviewed' | 'accepted' | 'dismissed' | 'published'

const FILTERS: Filter[] = ['all', 'new', 'reviewed', 'accepted', 'dismissed', 'published']

function filterVariable(filter: Filter) {
  return filter === 'all' ? undefined : { status: { _eq: filter } }
}

// The one component that fetches. The displayed list follows the status filter; a
// second query tracks the accepted offers, which is what the ticker is generated from.
export function OffersPanel() {
  const [filter, setFilter] = useState<Filter>('new')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ text: string; html: string } | null>(null)
  const [draftCount, setDraftCount] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [collecting, setCollecting] = useState(false)

  const { data, loading, error, refetch } = useQuery<OffersQueryResult>(OFFERS_QUERY, {
    variables: { filter: filterVariable(filter) },
    fetchPolicy: LIVE_FETCH_POLICY
  })

  const accepted = useQuery<OffersQueryResult>(OFFERS_QUERY, {
    variables: { filter: { status: { _eq: 'accepted' } } },
    fetchPolicy: LIVE_FETCH_POLICY
  })

  const [updateStatus] = useMutation<UpdateOfferStatusResult>(UPDATE_OFFER_STATUS_MUTATION)
  const [createOffer, createState] = useMutation<CreateOfferResult>(CREATE_OFFER_MUTATION)

  // While a background collection run works, poll the list so found offers appear live.
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(
    () => () => {
      if (pollRef.current) clearInterval(pollRef.current)
    },
    []
  )

  async function handleStatusChange(id: string, status: string) {
    setProblem(null)
    setBusyId(id)
    try {
      await updateStatus({ variables: { id, status } })
      await Promise.all([refetch(), accepted.refetch()])
    } catch (cause) {
      setProblem(messageOf(cause, 'Der Status konnte nicht geaendert werden.'))
    } finally {
      setBusyId(null)
    }
  }

  async function handleCreate(offer: { title: string; raw_text: string; contact: string }) {
    setProblem(null)
    try {
      await createOffer({ variables: offer })
      await refetch()
    } catch (cause) {
      setProblem(messageOf(cause, 'Das Inserat konnte nicht gespeichert werden.'))
    }
  }

  async function handleCollect() {
    setProblem(null)
    setNotice(null)
    try {
      const response = await fetch('/api/offers/collect', { method: 'POST' })
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
          : 'Suche gestartet — neue Inserate erscheinen in den naechsten Minuten automatisch.'
      )

      // Poll the list while the background run works (a full run takes a few minutes).
      setCollecting(true)
      if (pollRef.current) clearInterval(pollRef.current)
      let ticks = 0
      pollRef.current = setInterval(() => {
        ticks += 1
        void Promise.all([refetch(), accepted.refetch()]).catch(() => {})
        if (ticks >= 20) {
          if (pollRef.current) clearInterval(pollRef.current)
          pollRef.current = null
          setCollecting(false)
          setNotice('Suche abgeschlossen. Alle neuen Inserate sind jetzt in der Liste.')
        }
      }, 15000)
    } catch (cause) {
      setProblem(messageOf(cause, 'Die Suche nach neuen Inseraten konnte nicht gestartet werden.'))
      setCollecting(false)
    }
  }

  async function handleGenerate() {
    setProblem(null)
    setGenerating(true)
    try {
      const ids = (accepted.data?.offers ?? []).map((offer) => offer.id)
      const response = await fetch('/api/vermittlungsbuero/draft', {
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

      const payload = (await response.json()) as {
        data?: { text?: string; html?: string }
      }
      setDraft({ text: payload.data?.text ?? '', html: payload.data?.html ?? '' })
      setDraftCount(ids.length)
    } catch (cause) {
      setProblem(messageOf(cause, 'Der Vermittlungsbuero-Text konnte nicht erzeugt werden.'))
    } finally {
      setGenerating(false)
    }
  }

  // Move the accepted offers out of the pool once they have been used in an issue, so
  // they are never offered for a ticker again.
  async function handlePublish() {
    setProblem(null)
    setPublishing(true)
    try {
      const ids = (accepted.data?.offers ?? []).map((offer) => offer.id)
      for (const id of ids) {
        await updateStatus({ variables: { id, status: 'published' } })
      }
      await Promise.all([refetch(), accepted.refetch()])
      setDraft(null)
      setNotice(`${ids.length} Inserat${ids.length === 1 ? '' : 'e'} als veroeffentlicht markiert.`)
    } catch (cause) {
      setProblem(messageOf(cause, 'Die Inserate konnten nicht markiert werden.'))
    } finally {
      setPublishing(false)
    }
  }

  const offers = data?.offers ?? []
  const acceptedCount = accepted.data?.offers?.length ?? 0

  return (
    <Stack spacing={2}>
      <OfferComposer busy={createState.loading} onCreate={handleCreate} />

      <SourcesManager />

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
          {FILTERS.map((value) => (
            <ToggleButton key={value} value={value}>
              {value === 'all' ? 'Alle' : statusLabel(value)}
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
            {collecting ? 'Suche laeuft…' : 'Inserate suchen'}
          </Button>
          <Button
            variant="contained"
            disabled={acceptedCount === 0 || generating}
            startIcon={generating ? <CircularProgress size={16} /> : undefined}
            onClick={handleGenerate}
          >
            Vermittlungsbuero-Text generieren ({acceptedCount})
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
        <TickerDraft
          text={draft.text}
          html={draft.html}
          count={draftCount}
          publishing={publishing}
          onPublish={handlePublish}
          onClose={() => setDraft(null)}
        />
      )}

      {error !== undefined && (
        <Alert severity="error">Inserate konnten nicht geladen werden: {error.message}</Alert>
      )}

      {loading && offers.length === 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && offers.length === 0 && error === undefined && (
        <Typography color="text.secondary">Keine Inserate in dieser Ansicht.</Typography>
      )}

      {offers.map((offer) => (
        <OfferCard
          key={offer.id}
          offer={offer}
          busy={busyId === offer.id}
          onStatusChange={handleStatusChange}
        />
      ))}
    </Stack>
  )
}

function messageOf(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message !== '' ? cause.message : fallback
}
