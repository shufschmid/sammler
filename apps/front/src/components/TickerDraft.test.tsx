import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TickerDraft } from './TickerDraft'

describe('TickerDraft', () => {
  const text = '+++ Der Dupf Club sucht Laternenzieher (auf fraufasnacht.ch: https://x.test) +++'
  const html =
    '<p>+++ Der Dupf Club sucht Laternenzieher (<a href="https://x.test">auf fraufasnacht.ch</a>) +++</p>'

  function renderDraft(props: Partial<React.ComponentProps<typeof TickerDraft>> = {}) {
    return render(
      <TickerDraft
        text={text}
        html={html}
        count={2}
        publishing={false}
        onPublish={jest.fn()}
        onClose={jest.fn()}
        {...props}
      />
    )
  }

  it('renders the ticker preview with the source as a clickable link', () => {
    renderDraft()

    const link = screen.getByRole('link', { name: 'auf fraufasnacht.ch' })
    expect(link).toHaveAttribute('href', 'https://x.test')
    expect(screen.getByText(/Der Dupf Club sucht Laternenzieher/)).toBeInTheDocument()
  })

  it('closes on request', async () => {
    const onClose = jest.fn()
    renderDraft({ onClose })

    await userEvent.click(screen.getByRole('button', { name: 'Schliessen' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('marks the covered offers as published', async () => {
    const onPublish = jest.fn()
    renderDraft({ onPublish })

    await userEvent.click(screen.getByRole('button', { name: /Als veroeffentlicht markieren/ }))
    expect(onPublish).toHaveBeenCalled()
  })

  it('copies the ticker (plain-text fallback when ClipboardItem is unavailable)', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    renderDraft()
    await userEvent.click(screen.getByRole('button', { name: 'Kopieren' }))

    expect(writeText).toHaveBeenCalledWith(text)
    expect(await screen.findByRole('button', { name: 'Kopiert' })).toBeInTheDocument()
  })
})
