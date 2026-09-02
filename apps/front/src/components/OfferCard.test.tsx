import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { OfferFields } from '@/graphql/offers'
import { OfferCard } from './OfferCard'

function offer(overrides: Partial<OfferFields> = {}): OfferFields {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    status: 'new',
    source: 'fraufasnacht',
    source_url: 'https://fraufasnacht.ch/marktplatz/detailansicht/?id=1',
    title: 'Harlekin-Marionette zu verkaufen',
    raw_text: 'Handgemacht, Neupreis CHF 750.',
    contact: 'alexander.hoffmann@example.ch',
    listed_at: '2026-08-30',
    ai_category: 'verkauft',
    ai_summary: 'Verkauft wird eine handgemachte Harlekin-Marionette.',
    ai_audience: 'Sammler*innen',
    ai_evergreen: false,
    ai_generated_at: '2026-09-02T06:00:00Z',
    date_created: '2026-09-02T06:00:00Z',
    ...overrides
  }
}

describe('OfferCard', () => {
  it('shows title, source, category and the ticker summary', () => {
    render(<OfferCard offer={offer()} busy={false} onStatusChange={jest.fn()} />)

    expect(screen.getByText('Harlekin-Marionette zu verkaufen')).toBeInTheDocument()
    expect(screen.getByText('fraufasnacht.ch')).toBeInTheDocument()
    expect(screen.getByText('Verkauft')).toBeInTheDocument()
    expect(screen.getByText('Verkauft wird eine handgemachte Harlekin-Marionette.')).toBeInTheDocument()
    expect(screen.getByText(/alexander\.hoffmann@example\.ch/)).toBeInTheDocument()
  })

  it('reports the new status when changed', async () => {
    const onStatusChange = jest.fn()
    render(<OfferCard offer={offer()} busy={false} onStatusChange={onStatusChange} />)

    await userEvent.click(screen.getByRole('combobox', { name: 'Status' }))
    await userEvent.click(screen.getByRole('option', { name: 'Uebernommen' }))

    expect(onStatusChange).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111', 'accepted')
  })

  it('renders without a summary before classification', () => {
    render(
      <OfferCard
        offer={offer({ ai_summary: null, ai_category: null })}
        busy={false}
        onStatusChange={jest.fn()}
      />
    )

    expect(screen.queryByText('Ticker-Vorschlag von Claude')).not.toBeInTheDocument()
  })
})
