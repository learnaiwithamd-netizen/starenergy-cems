import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { axe } from 'vitest-axe'
import type { AuditDetail } from '@cems/types'
import { AuditStatus } from '@cems/types'
import { SectionOverviewPage } from './SectionOverviewPage'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function renderPage(auditId = 'audit-abc') {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/audit/${auditId}`]}>
        <Routes>
          <Route path="/audit/:auditId" element={<SectionOverviewPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const baseAudit: AuditDetail = {
  id: 'audit-abc',
  storeId: 'store-001',
  status: AuditStatus.DRAFT,
  currentSectionId: null,
  formVersion: '1.0',
  compressorDbVersion: '2.0',
  createdAt: '2026-05-08T10:00:00.000Z',
  updatedAt: '2026-05-09T10:00:00.000Z',
  sections: [],
}

describe('SectionOverviewPage', () => {
  it('shows loading skeleton while fetching audit', async () => {
    let resolve!: (r: Response) => void
    fetchMock.mockReturnValue(new Promise<Response>((r) => { resolve = r }))
    const { container } = renderPage()
    await waitFor(() => expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument())
    resolve(jsonResponse(baseAudit))
  })

  it('renders 5 section cards all in Not Started state when no sections persisted', async () => {
    fetchMock.mockResolvedValue(jsonResponse(baseAudit))
    renderPage()
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /General: Not Started/i })).toBeInTheDocument(),
    )
    for (const name of ['General', 'Refrigeration', 'HVAC', 'Lighting', 'Building Envelope']) {
      expect(
        screen.getByRole('link', { name: new RegExp(`${name}: Not Started`, 'i') }),
      ).toBeInTheDocument()
    }
  })

  it('shows 0 of 5 sections complete on a fresh draft', async () => {
    fetchMock.mockResolvedValue(jsonResponse(baseAudit))
    renderPage()
    await waitFor(() =>
      expect(screen.getByText(/0 of 5 sections complete/i)).toBeInTheDocument(),
    )
  })

  it('renders In Progress for general when sections.data is non-empty', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        ...baseAudit,
        sections: [
          {
            sectionId: 'general',
            data: { auditDate: '2026-05-09' },
            completedAt: null,
            updatedAt: '2026-05-09T10:00:00.000Z',
          },
        ],
      }),
    )
    renderPage()
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /General: In Progress/i })).toBeInTheDocument(),
    )
    expect(screen.getByRole('link', { name: /HVAC: Not Started/i })).toBeInTheDocument()
  })

  it('shows Continue CTA targeting current_section_id', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        ...baseAudit,
        currentSectionId: 'hvac',
      }),
    )
    renderPage()
    await waitFor(() => {
      const cta = screen.getByTestId('continue-cta')
      expect(cta).toHaveAttribute('href', '/audit/audit-abc/section/hvac')
    })
  })

  it('does not render Continue when current_section_id is null', async () => {
    fetchMock.mockResolvedValue(jsonResponse(baseAudit))
    renderPage()
    await waitFor(() => expect(screen.getByText(/0 of 5 sections complete/i)).toBeInTheDocument())
    expect(screen.queryByTestId('continue-cta')).not.toBeInTheDocument()
  })

  it('renders ✓ checkmark and Complete aria-label when section has completedAt (AC4)', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        ...baseAudit,
        sections: [
          {
            sectionId: 'general',
            data: { auditDate: '2026-05-09' },
            completedAt: '2026-05-09T12:00:00.000Z',
            updatedAt: '2026-05-09T12:00:00.000Z',
          },
        ],
      }),
    )
    renderPage()
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /General: Complete/i })).toBeInTheDocument(),
    )
    const card = screen.getByTestId('section-card-general')
    expect(card).toHaveTextContent('✓')
    expect(screen.getByRole('link', { name: /Refrigeration: Not Started/i })).toBeInTheDocument()
  })

  it('shows 1 of 5 sections complete and progress bar at 20% (AC6)', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        ...baseAudit,
        sections: [
          {
            sectionId: 'general',
            data: {},
            completedAt: '2026-05-09T12:00:00.000Z',
            updatedAt: '2026-05-09T12:00:00.000Z',
          },
        ],
      }),
    )
    renderPage()
    await waitFor(() => expect(screen.getByText(/1 of 5 sections complete/i)).toBeInTheDocument())
    const bar = screen.getByRole('progressbar')
    expect(bar).toBeInTheDocument()
    expect(bar).toHaveAttribute('aria-valuenow', '20')
  })

  it('progress bar reflects 2 of 5 complete (40%) (AC6)', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        ...baseAudit,
        sections: [
          { sectionId: 'general', data: {}, completedAt: '2026-05-09T12:00:00.000Z', updatedAt: '2026-05-09T12:00:00.000Z' },
          { sectionId: 'hvac', data: {}, completedAt: '2026-05-09T12:00:00.000Z', updatedAt: '2026-05-09T12:00:00.000Z' },
        ],
      }),
    )
    renderPage()
    await waitFor(() => expect(screen.getByText(/2 of 5 sections complete/i)).toBeInTheDocument())
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '40')
  })

  it('passes axe scan with mixed Not Started / In Progress / Complete states (AC4+AC6)', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        ...baseAudit,
        sections: [
          { sectionId: 'general', data: {}, completedAt: '2026-05-09T12:00:00.000Z', updatedAt: '2026-05-09T12:00:00.000Z' },
          { sectionId: 'hvac', data: { field: 'val' }, completedAt: null, updatedAt: '2026-05-09T12:00:00.000Z' },
        ],
      }),
    )
    const { container } = renderPage()
    await waitFor(() => expect(screen.getByRole('link', { name: /General: Complete/i })).toBeInTheDocument())
    const results = await axe(container, { rules: { 'color-contrast': { enabled: false } } })
    expect(results).toHaveNoViolations()
  })

  it('shows error alert when fetch fails', async () => {
    fetchMock.mockResolvedValue(new Response('boom', { status: 500 }))
    renderPage()
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  })

  it('passes axe accessibility scan', async () => {
    fetchMock.mockResolvedValue(jsonResponse(baseAudit))
    const { container } = renderPage()
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /General: Not Started/i })).toBeInTheDocument(),
    )
    const results = await axe(container, { rules: { 'color-contrast': { enabled: false } } })
    expect(results).toHaveNoViolations()
  })
})
