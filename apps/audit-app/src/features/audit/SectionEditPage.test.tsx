import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { axe } from 'vitest-axe'
import type { AuditDetail } from '@cems/types'
import { AuditStatus } from '@cems/types'
import { SectionEditPage } from './SectionEditPage'

const fetchMock = vi.fn()

let onLineValue = true

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  onLineValue = true
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => onLineValue,
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  onLineValue = true
  // TanStack Query v5's online manager listens for 'online'/'offline' events
  // and pauses queries while offline. Without this dispatch, the offline
  // test leaves the manager in a paused state for subsequent tests.
  window.dispatchEvent(new Event('online'))
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function buildAudit(overrides: Partial<AuditDetail> = {}): AuditDetail {
  return {
    id: 'audit-abc',
    storeId: 'store-001',
    status: AuditStatus.DRAFT,
    currentSectionId: null,
    formVersion: '1.0',
    compressorDbVersion: '2.0',
    createdAt: '2026-05-08T10:00:00.000Z',
    updatedAt: '2026-05-09T10:00:00.000Z',
    sections: [],
    ...overrides,
  }
}

function renderPage(route = '/audit/audit-abc/section/general') {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/audit/:auditId/section/:sectionId" element={<SectionEditPage />} />
          <Route path="/audit/:auditId" element={<div data-testid="overview" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SectionEditPage — general section', () => {
  it('hydrates form fields from existing section data (AC6)', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        buildAudit({
          sections: [
            {
              sectionId: 'general',
              data: {
                auditDate: '2026-05-09',
                weatherConditions: 'Sunny',
                onSiteContact: 'Jane Doe',
                generalNotes: 'No issues',
              },
              completedAt: null,
              updatedAt: '2026-05-09T10:00:00.000Z',
            },
          ],
        }),
      ),
    )
    renderPage()
    await waitFor(() =>
      expect(screen.getByTestId('general-audit-date')).toHaveValue('2026-05-09'),
    )
    expect(screen.getByTestId('general-weather')).toHaveValue('Sunny')
    expect(screen.getByTestId('general-contact')).toHaveValue('Jane Doe')
    expect(screen.getByTestId('general-notes')).toHaveValue('No issues')
  })

  it('typing → 800ms later → fires PATCH with the field value (AC1)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    fetchMock
      .mockResolvedValueOnce(jsonResponse(buildAudit()))
      .mockResolvedValueOnce(
        jsonResponse({ sectionId: 'general', savedAt: '2026-05-09T10:00:01.000Z' }),
      )

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderPage()
    await waitFor(() => expect(screen.getByTestId('general-weather')).toBeInTheDocument())

    await user.type(screen.getByTestId('general-weather'), 'Cloudy')

    await act(async () => {
      vi.advanceTimersByTime(900)
      await Promise.resolve()
    })

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(
        (c) => (c[1] as RequestInit).method === 'PATCH',
      )
      expect(patchCall).toBeDefined()
      const body = JSON.parse((patchCall![1] as RequestInit).body as string) as {
        data: Record<string, string>
      }
      expect(body.data.weatherConditions).toBe('Cloudy')
    })
  })

  it('shows ✓ Saved after a successful PATCH (AC2)', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(buildAudit()))
      .mockResolvedValueOnce(
        jsonResponse({ sectionId: 'general', savedAt: '2026-05-09T10:00:01.000Z' }),
      )
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByTestId('general-weather')).toBeInTheDocument())

    await user.type(screen.getByTestId('general-weather'), 'Cloudy')
    await waitFor(
      () => expect(screen.getByText('✓ Saved')).toBeInTheDocument(),
      { timeout: 2_000 },
    )
  })

  it('shows Save failed — retrying when PATCH returns 500 (AC3)', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(buildAudit()))
      .mockResolvedValueOnce(new Response('boom', { status: 500 }))
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByTestId('general-weather')).toBeInTheDocument())

    await user.type(screen.getByTestId('general-weather'), 'X')
    await waitFor(
      () => expect(screen.getByText('Save failed — retrying')).toBeInTheDocument(),
      { timeout: 2_000 },
    )
  })

  it('shows OfflineBanner when navigator goes offline (AC4)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(buildAudit()))
    renderPage()
    await waitFor(() => expect(screen.getByTestId('general-weather')).toBeInTheDocument())

    onLineValue = false
    await act(async () => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(screen.getByTestId('offline-banner')).toBeInTheDocument()
  })

  it('passes axe accessibility scan after hydration', async () => {
    fetchMock.mockResolvedValue(jsonResponse(buildAudit()))
    const { container } = renderPage()
    await waitFor(() => expect(screen.getByTestId('general-weather')).toBeInTheDocument())
    const results = await axe(container, { rules: { 'color-contrast': { enabled: false } } })
    expect(results).toHaveNoViolations()
  })
})

describe('SectionEditPage — non-general sections', () => {
  it('renders coming-soon stub for hvac with a stub save button', async () => {
    fetchMock.mockResolvedValue(jsonResponse(buildAudit()))
    renderPage('/audit/audit-abc/section/hvac')
    await waitFor(() =>
      expect(screen.getByText(/HVAC section forms arrive in Story 5\.2/i)).toBeInTheDocument(),
    )
    expect(screen.getByTestId('stub-save')).toBeInTheDocument()
  })

  it('redirects to overview when sectionId is unknown', async () => {
    fetchMock.mockResolvedValue(jsonResponse(buildAudit()))
    renderPage('/audit/audit-abc/section/bogus')
    await waitFor(() => expect(screen.getByTestId('overview')).toBeInTheDocument())
  })
})
