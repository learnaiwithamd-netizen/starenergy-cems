import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { OfflineBanner } from './OfflineBanner'

describe('OfflineBanner', () => {
  let originalOnLine: PropertyDescriptor | undefined
  let onLineValue = true

  beforeEach(() => {
    originalOnLine = Object.getOwnPropertyDescriptor(window.navigator, 'onLine')
    onLineValue = true
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => onLineValue,
    })
  })

  afterEach(() => {
    if (originalOnLine) Object.defineProperty(window.navigator, 'onLine', originalOnLine)
    vi.useRealTimers()
  })

  it('returns null when online', () => {
    onLineValue = true
    const { container } = render(<OfflineBanner lastSavedAt={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders banner when offline', () => {
    onLineValue = false
    render(<OfflineBanner lastSavedAt={null} />)
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(screen.getByTestId('offline-banner')).toBeInTheDocument()
    expect(screen.getByText(/Reconnecting/)).toBeInTheDocument()
  })

  it('shows "<1m ago" when lastSavedAt is recent', () => {
    onLineValue = false
    vi.setSystemTime(new Date('2026-05-09T10:00:30Z'))
    render(<OfflineBanner lastSavedAt="2026-05-09T10:00:00.000Z" />)
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(screen.getByTestId('offline-banner').textContent).toContain('<1m ago')
  })

  it('shows "Xm ago" when lastSavedAt is minutes old', () => {
    onLineValue = false
    vi.setSystemTime(new Date('2026-05-09T10:05:00Z'))
    render(<OfflineBanner lastSavedAt="2026-05-09T10:00:00.000Z" />)
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(screen.getByTestId('offline-banner').textContent).toContain('5m ago')
  })

  it('shows "Xh ago" when lastSavedAt is hours old', () => {
    onLineValue = false
    vi.setSystemTime(new Date('2026-05-09T13:00:00Z'))
    render(<OfflineBanner lastSavedAt="2026-05-09T10:00:00.000Z" />)
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(screen.getByTestId('offline-banner').textContent).toContain('3h ago')
  })

  it('shows "never" when lastSavedAt is null', () => {
    onLineValue = false
    render(<OfflineBanner lastSavedAt={null} />)
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(screen.getByTestId('offline-banner').textContent).toContain('never')
  })

  it('disappears after online event', () => {
    onLineValue = false
    render(<OfflineBanner lastSavedAt={null} />)
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(screen.queryByTestId('offline-banner')).toBeInTheDocument()

    act(() => {
      onLineValue = true
      window.dispatchEvent(new Event('online'))
    })
    expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument()
  })
})
