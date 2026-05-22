import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { axe } from 'vitest-axe'
import { CompressorEntryPage } from './CompressorEntryPage'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const machineRoomsResponse = {
  machineRooms: [{ id: 'mr-1', auditId: 'audit-abc', roomNumber: '1', data: {}, createdAt: 'x', updatedAt: 'x' }],
}

function rackResponse() {
  return { id: 'rack-1', tenantId: 'tenant-a', machineRoomId: 'mr-1', rackNumber: '2', data: {}, createdAt: 'x', updatedAt: 'x' }
}

function compressorResponse(data: Record<string, unknown> = {}, compressorRefId: string | null = null) {
  return {
    id: 'comp-1',
    tenantId: 'tenant-a',
    rackId: 'rack-1',
    compressorNumber: '3',
    compressorRefId,
    data,
    createdAt: 'x',
    updatedAt: 'x',
  }
}

const foundRef = {
  id: 'ref-1',
  compressorDbVersion: '1.0',
  modelNumber: 'ZB45KCE-TFD',
  manufacturer: 'Copeland',
  refrigerantType: 'R-404A',
  regressionCoefficients: { capacity: '45000', eer: '11.2' },
  createdAt: 'x',
}

/** Route fetch calls by URL + method. Order is significant. */
function routeFetch(handlers: {
  rooms?: () => Response
  rack?: () => Response
  compressor?: () => Response
  patch?: () => Response
  lookup?: (url: string) => Response
  report?: () => Response
}) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    if (url.includes('/report-unknown-model'))
      return Promise.resolve((handlers.report ?? (() => jsonResponse({ reported: true, adminsNotified: 1 })))())
    if (!url.includes('/machine-rooms') && url.includes('/api/v1/compressors/'))
      return Promise.resolve((handlers.lookup ?? (() => jsonResponse(foundRef)))(url))
    if (method === 'PATCH')
      return Promise.resolve((handlers.patch ?? (() => jsonResponse({ savedAt: 'x', compressorId: 'comp-1' })))())
    if (url.endsWith('/machine-rooms'))
      return Promise.resolve((handlers.rooms ?? (() => jsonResponse(machineRoomsResponse)))())
    if (url.includes('/compressors/'))
      return Promise.resolve((handlers.compressor ?? (() => jsonResponse(compressorResponse())))())
    if (url.includes('/racks/')) return Promise.resolve((handlers.rack ?? (() => jsonResponse(rackResponse())))())
    return Promise.resolve(jsonResponse({}, 404))
  })
}

const ROUTE = '/audit/audit-abc/section/refrigeration/rack/rack-1/compressor/comp-1'

function renderPage(route = ROUTE) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route
            path="/audit/:auditId/section/refrigeration/rack/:rackId/compressor/:compressorId"
            element={<CompressorEntryPage />}
          />
          <Route
            path="/audit/:auditId/section/refrigeration/rack/:rackId/compressors"
            element={<div data-testid="compressors-page" />}
          />
          <Route path="/audit/:auditId/section/refrigeration" element={<div data-testid="general-page" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function reportCalled(): boolean {
  return fetchMock.mock.calls.some(([url]) => String(url).includes('/report-unknown-model'))
}

describe('CompressorEntryPage', () => {
  it('shows skeleton while loading', () => {
    fetchMock.mockImplementation(() => new Promise(() => {}))
    renderPage()
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull()
  })

  it('shows error alert when the compressor GET fails', async () => {
    routeFetch({ compressor: () => jsonResponse({ detail: 'fail' }, 500) })
    renderPage()
    await screen.findByRole('alert')
    expect(screen.getByRole('alert').textContent).toContain('Could not load compressor')
  })

  it('renders all compressor form fields', async () => {
    routeFetch({})
    renderPage()
    await screen.findByText('Compressor')
    expect(screen.getByTestId('compressor-model')).toBeDefined()
    expect(screen.getByTestId('compressor-make')).toBeDefined()
    expect(screen.getByTestId('compressor-serial')).toBeDefined()
    expect(screen.getByTestId('compressor-capacity')).toBeDefined()
    expect(screen.getByTestId('compressor-eer')).toBeDefined()
    expect(screen.getByTestId('compressor-refrigerant')).toBeDefined()
    expect(screen.getByTestId('comment-field')).toBeDefined()
  })

  it('empty model number blocks navigation and shows the count label', async () => {
    routeFetch({})
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('next-btn')
    await user.click(screen.getByTestId('next-btn'))
    await waitFor(() => {
      expect(screen.getByTestId('next-btn').textContent).toContain('required field')
    })
    expect(screen.queryByTestId('compressors-page')).toBeNull()
  })

  it('auto-populates make / refrigerant / capacity / EER from a regression-DB match', async () => {
    routeFetch({})
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('compressor-model')

    await user.type(screen.getByTestId('compressor-model'), 'ZB45KCE-TFD')

    await waitFor(
      () => {
        expect((screen.getByTestId('compressor-make') as HTMLInputElement).value).toBe('Copeland')
      },
      { timeout: 3000 },
    )
    expect((screen.getByTestId('compressor-capacity') as HTMLInputElement).value).toBe('45000')
    expect((screen.getByTestId('compressor-eer') as HTMLInputElement).value).toBe('11.2')
    expect(screen.getByTestId('compressor-refrigerant').textContent).toContain('R-404A')
  })

  it('shows the amber model-not-found alert on a 404 lookup', async () => {
    routeFetch({ lookup: () => jsonResponse({ detail: 'not found' }, 404) })
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('compressor-model')

    await user.type(screen.getByTestId('compressor-model'), 'UNKNOWN-1')

    const alert = await screen.findByTestId('model-not-found-alert', {}, { timeout: 3000 })
    expect(alert.textContent).toContain('Model not found')
  })

  it('lets the Auditor override an auto-populated value', async () => {
    routeFetch({})
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('compressor-model')

    await user.type(screen.getByTestId('compressor-model'), 'ZB45KCE-TFD')
    await waitFor(() => expect((screen.getByTestId('compressor-make') as HTMLInputElement).value).toBe('Copeland'), {
      timeout: 3000,
    })

    const makeInput = screen.getByTestId('compressor-make')
    await user.clear(makeInput)
    await user.type(makeInput, 'Copeland (refurb)')
    expect((makeInput as HTMLInputElement).value).toBe('Copeland (refurb)')
  })

  it('valid submit with a found model navigates to the compressor list WITHOUT notifying admins', async () => {
    routeFetch({})
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('compressor-model')

    await user.type(screen.getByTestId('compressor-model'), 'ZB45KCE-TFD')
    await waitFor(() => expect((screen.getByTestId('compressor-make') as HTMLInputElement).value).toBe('Copeland'), {
      timeout: 3000,
    })

    await user.click(screen.getByTestId('next-btn'))
    await screen.findByTestId('compressors-page')
    expect(reportCalled()).toBe(false)
  })

  it('valid submit with an unknown model notifies admins then navigates', async () => {
    routeFetch({ lookup: () => jsonResponse({ detail: 'not found' }, 404) })
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('compressor-model')

    await user.type(screen.getByTestId('compressor-model'), 'UNKNOWN-1')
    await screen.findByTestId('model-not-found-alert', {}, { timeout: 3000 })

    await user.click(screen.getByTestId('next-btn'))
    await screen.findByTestId('compressors-page')
    expect(reportCalled()).toBe(true)
  })

  it('hydrates the form from saved compressor data', async () => {
    routeFetch({
      compressor: () =>
        jsonResponse(compressorResponse({ general: { modelNumber: 'ZB45KCE-TFD', serialNumber: 'SN-9' } }, 'ref-1')),
    })
    renderPage()
    await screen.findByText('Compressor')
    await waitFor(() => {
      expect((screen.getByTestId('compressor-serial') as HTMLInputElement).value).toBe('SN-9')
    })
  })

  it('passes axe accessibility scan', async () => {
    routeFetch({})
    const { container } = renderPage()
    await screen.findByText('Compressor')
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
