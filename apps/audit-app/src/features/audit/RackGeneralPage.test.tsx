import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { axe } from 'vitest-axe'
import { RackGeneralPage } from './RackGeneralPage'

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
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const machineRoomsResponse = {
  machineRooms: [
    {
      id: 'mr-1',
      auditId: 'audit-abc',
      roomNumber: '1',
      data: {},
      createdAt: '2026-05-16T10:00:00.000Z',
      updatedAt: '2026-05-16T10:00:00.000Z',
    },
  ],
}

function rackResponse(data: Record<string, unknown> = {}) {
  return {
    id: 'rack-1',
    tenantId: 'tenant-a',
    machineRoomId: 'mr-1',
    rackNumber: '2',
    data,
    createdAt: '2026-05-16T10:00:00.000Z',
    updatedAt: '2026-05-16T10:00:00.000Z',
  }
}

/** Route fetch calls by URL + method. */
function routeFetch(handlers: { rooms?: () => Response; rack?: () => Response; patch?: () => Response }) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    if (url.endsWith('/machine-rooms'))
      return Promise.resolve((handlers.rooms ?? (() => jsonResponse(machineRoomsResponse)))())
    if (method === 'PATCH')
      return Promise.resolve(
        (handlers.patch ?? (() => jsonResponse({ savedAt: '2026-05-16T10:00:00.000Z', rackId: 'rack-1' })))(),
      )
    if (url.includes('/racks/')) return Promise.resolve((handlers.rack ?? (() => jsonResponse(rackResponse())))())
    return Promise.resolve(jsonResponse({}, 404))
  })
}

function renderPage(route = '/audit/audit-abc/section/refrigeration/rack/rack-1/general') {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/audit/:auditId/section/refrigeration/rack/:rackId/general" element={<RackGeneralPage />} />
          <Route
            path="/audit/:auditId/section/refrigeration/rack/:rackId/pipe-headers"
            element={<div data-testid="pipe-headers-stub" />}
          />
          <Route path="/audit/:auditId/section/refrigeration" element={<div data-testid="general-page" />} />
          <Route path="/audit/:auditId" element={<div data-testid="overview-page" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('RackGeneralPage', () => {
  it('shows skeleton while loading', () => {
    fetchMock.mockImplementation(() => new Promise(() => {}))
    renderPage()
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull()
  })

  it('shows error alert when rack GET fails', async () => {
    routeFetch({ rack: () => jsonResponse({ detail: 'fail' }, 500) })
    renderPage()
    await screen.findByRole('alert')
    expect(screen.getByRole('alert').textContent).toContain('Could not load rack')
  })

  it('renders all rack general form fields', async () => {
    routeFetch({})
    renderPage()
    await screen.findByText('Rack — General')
    expect(screen.getByTestId('rack-designation')).toBeDefined()
    expect(screen.getByTestId('rack-type')).toBeDefined()
    expect(screen.getByTestId('rack-make')).toBeDefined()
    expect(screen.getByTestId('rack-model-serial')).toBeDefined()
    expect(screen.getByTestId('age-year')).toBeDefined()
    expect(screen.getByTestId('last-retrofit-year')).toBeDefined()
    expect(screen.getByTestId('refrigerant')).toBeDefined()
    expect(screen.getByTestId('comment-field')).toBeDefined()
  })

  it('empty designation blocks navigation and shows error count', async () => {
    routeFetch({})
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('next-btn')
    await user.click(screen.getByTestId('next-btn'))
    await waitFor(() => {
      expect(screen.getByTestId('next-btn').textContent).toContain('required field')
    })
    expect(screen.queryByTestId('pipe-headers-stub')).toBeNull()
  })

  it('valid form navigates to the pipe-headers stub', async () => {
    routeFetch({})
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('rack-designation')

    await user.click(screen.getByTestId('rack-designation'))
    await user.click(await screen.findByRole('option', { name: 'A' }))
    await user.click(screen.getByTestId('next-btn'))

    await screen.findByTestId('pipe-headers-stub')
  })

  it('hydrates the form from saved rack data', async () => {
    routeFetch({
      rack: () => jsonResponse(rackResponse({ general: { rackDesignation: 'B', rackModelSerial: 'SN-123' } })),
    })
    renderPage()
    await screen.findByText('Rack — General')
    await waitFor(() => {
      expect((screen.getByTestId('rack-model-serial') as HTMLInputElement).value).toBe('SN-123')
    })
  })

  it('field change triggers an auto-save PATCH after the debounce', async () => {
    routeFetch({})
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('rack-model-serial')

    await user.type(screen.getByTestId('rack-model-serial'), 'X')

    // 800ms debounce — wait for the PATCH to fire.
    await waitFor(
      () => {
        const patched = fetchMock.mock.calls.some(
          ([url, init]) => (init?.method ?? 'GET') === 'PATCH' && String(url).includes('/racks/rack-1'),
        )
        expect(patched).toBe(true)
      },
      { timeout: 2000 },
    )
  })

  it('passes axe accessibility scan', async () => {
    routeFetch({})
    const { container } = renderPage()
    await screen.findByText('Rack — General')
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
