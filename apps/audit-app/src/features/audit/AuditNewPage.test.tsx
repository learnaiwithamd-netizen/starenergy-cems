import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { axe } from 'vitest-axe'

const fetchMock = vi.fn()
const navigateMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  navigateMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

import { AuditNewPage } from './AuditNewPage'

const sampleStore = {
  id: 's-1',
  storeNumber: 'STORE-001',
  storeName: 'Sobeys A',
  address: '123 Main St, Toronto, ON',
  banner: 'Sobeys',
  region: 'ON',
  postalCode: 'M1A 1A1',
  operatingHours: 'Mon-Sun 7am-11pm',
  serviceProviders: ['HVAC Co'],
  storeManager: 'Jane Doe',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function renderPage(storeNumber = 'STORE-001') {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/audit/new?storeNumber=${storeNumber}`]}>
        <AuditNewPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AuditNewPage', () => {
  it('shows loading skeleton while fetching store detail (AC1)', async () => {
    let resolve!: (r: Response) => void
    fetchMock.mockReturnValue(new Promise<Response>((r) => { resolve = r }))
    const { container } = renderPage()
    await waitFor(() =>
      expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument(),
    )
    resolve(jsonResponse(sampleStore))
  })

  it('passes axe scan on loading skeleton state', async () => {
    let resolve!: (r: Response) => void
    fetchMock.mockReturnValue(new Promise<Response>((r) => { resolve = r }))
    const { container } = renderPage()
    await waitFor(() =>
      expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument(),
    )
    const results = await axe(container, { rules: { 'color-contrast': { enabled: false } } })
    expect(results).toHaveNoViolations()
    resolve(jsonResponse(sampleStore))
  })

  it('renders pre-filled store fields after load (AC1)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(sampleStore))
    renderPage()
    await waitFor(() => expect(screen.getByText('Sobeys A')).toBeInTheDocument())
    expect(screen.getByText('123 Main St, Toronto, ON')).toBeInTheDocument()
    expect(screen.getByText('Mon-Sun 7am-11pm')).toBeInTheDocument()
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('HVAC Co')).toBeInTheDocument()
  })

  it('shows error alert when store fetch fails', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 404 }))
    renderPage()
    await waitFor(() =>
      expect(screen.getByRole('alert')).toBeInTheDocument(),
    )
  })

  it('Start Audit button is disabled while store is loading', async () => {
    let resolve!: (r: Response) => void
    fetchMock.mockReturnValue(new Promise<Response>((r) => { resolve = r }))
    renderPage()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /start audit/i })).toBeDisabled(),
    )
    resolve(jsonResponse(sampleStore))
  })

  it('Start Audit calls POST /api/v1/audits and navigates to section overview (AC3, AC4)', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(sampleStore))
      .mockResolvedValueOnce(jsonResponse({ auditId: 'audit-xyz' }, 201))
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByText('Sobeys A')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /start audit/i }))
    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith('/audit/audit-xyz'),
    )
  })

  it('shows error alert when audit creation fails (AC3)', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(sampleStore))
      .mockResolvedValueOnce(new Response('', { status: 500 }))
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByText('Sobeys A')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /start audit/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  })

  it('passes axe accessibility scan after load', async () => {
    fetchMock.mockResolvedValue(jsonResponse(sampleStore))
    const { container } = renderPage()
    await waitFor(() => expect(screen.getByText('Sobeys A')).toBeInTheDocument())
    const results = await axe(container, { rules: { 'color-contrast': { enabled: false } } })
    expect(results).toHaveNoViolations()
  })
})
