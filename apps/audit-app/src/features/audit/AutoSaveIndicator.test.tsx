import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AutoSaveIndicator } from './AutoSaveIndicator'

describe('AutoSaveIndicator', () => {
  it('renders empty container in idle state', () => {
    render(<AutoSaveIndicator state="idle" />)
    const region = screen.getByRole('status')
    expect(region).toBeInTheDocument()
    expect(region.textContent).toBe('')
  })

  it('renders empty container in saving state (silent per AC1)', () => {
    render(<AutoSaveIndicator state="saving" />)
    const region = screen.getByRole('status')
    expect(region.textContent).toBe('')
  })

  it('shows ✓ Saved in saved state (P11: ✓ aria-hidden)', () => {
    render(<AutoSaveIndicator state="saved" />)
    expect(screen.getByText(/Saved/)).toBeInTheDocument()
    // ✓ is decorative — visually-only, aria-hidden so screen readers say "Saved".
    expect(screen.getByText('✓ ')).toHaveAttribute('aria-hidden', 'true')
  })

  it('shows Save failed — please reload in error-terminal state (P4)', () => {
    render(<AutoSaveIndicator state="error-terminal" />)
    expect(screen.getByText('Save failed — please reload')).toBeInTheDocument()
  })

  it('shows Save failed — retrying in error state', () => {
    render(<AutoSaveIndicator state="error" />)
    expect(screen.getByText('Save failed — retrying')).toBeInTheDocument()
  })

  it('container is aria-live polite for screen readers', () => {
    render(<AutoSaveIndicator state="saved" />)
    const region = screen.getByRole('status')
    expect(region.getAttribute('aria-live')).toBe('polite')
  })
})
