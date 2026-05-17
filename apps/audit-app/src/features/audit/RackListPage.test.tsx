import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RackListPage } from './RackListPage'

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

function rack(id: string, data: Record<string, unknown>, rackNumber = '1') {
  return {
    id,
    tenantId: 'tenant-a',
    machineRoomId: 'mr-1',
    rackNumber,
    data,
    createdAt: '2026-05-16T10:00:00.000Z',
    updatedAt: '2026-05-16T10:00:00.000Z',
  }
}

/** Route fetch calls by URL + method. */
function routeFetch(handlers: {
  rooms?: () => Response
  racksList?: () => Response
  create?: () => Response
  duplicate?: () => Response
}) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    if (url.endsWith('/machine-rooms')) return Promise.resolve((handlers.rooms ?? (() => jsonResponse(machineRoomsResponse)))())
    if (url.includes('/duplicate')) return Promise.resolve((handlers.duplicate ?? (() => jsonResponse(rack('rack-dup', {}))))())
    if (url.endsWith('/racks') && method === 'POST')
      return Promise.resolve((handlers.create ?? (() => jsonResponse(rack('rack-new', {}))))())
    if (url.endsWith('/racks')) return Promise.resolve((handlers.racksList ?? (() => jsonResponse({ racks: [] })))())
    return Promise.resolve(jsonResponse({}, 404))
  })
}

function renderPage(route = '/audit/audit-abc/section/refrigeration/racks') {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/audit/:auditId/section/refrigeration/racks" element={<RackListPage />} />
          <Route
            path="/audit/:auditId/section/refrigeration/rack/:rackId/general"
            element={<div data-testid="rack-general-page" />}
          />
          <Route path="/audit/:auditId/section/refrigeration" element={<div data-testid="general-page" />} />
          <Route path="/audit/:auditId" element={<div data-testid="overview-page" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('RackListPage', () => {
  it('shows skeleton while loading', () => {
    fetchMock.mockImplementation(() => new Promise(() => {}))
    renderPage()
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull()
  })

  it('shows error alert when machine rooms GET fails', async () => {
    routeFetch({ rooms: () => jsonResponse({ detail: 'fail' }, 500) })
    renderPage()
    await screen.findByRole('alert')
    expect(screen.getByRole('alert').textContent).toContain('Could not load racks')
  })

  it('renders rack list with status chips', async () => {
    routeFetch({
      racksList: () =>
        jsonResponse({
          racks: [
            rack('rack-1', { general: { rackDesignation: 'A' } }, '1'),
            rack('rack-2', {}, '2'),
          ],
        }),
    })
    renderPage()
    await screen.findByTestId('rack-list')
    expect(screen.getByTestId('rack-card-rack-1')).toBeDefined()
    expect(screen.getByTestId('rack-card-rack-2')).toBeDefined()
  })

  it('"Not Started" rack shows the correct chip', async () => {
    routeFetch({ racksList: () => jsonResponse({ racks: [rack('rack-2', {}, '2')] }) })
    renderPage()
    const chip = await screen.findByTestId('rack-status-rack-2')
    expect(chip.textContent).toBe('Not Started')
  })

  it('"Complete" rack shows the correct chip', async () => {
    routeFetch({
      racksList: () => jsonResponse({ racks: [rack('rack-1', { general: { rackDesignation: 'A' } }, '1')] }),
    })
    renderPage()
    const chip = await screen.findByTestId('rack-status-rack-1')
    expect(chip.textContent).toBe('Complete')
  })

  it('"Add Rack" triggers create and navigates to the new rack', async () => {
    routeFetch({
      racksList: () => jsonResponse({ racks: [] }),
      create: () => jsonResponse(rack('rack-new', {}, '1')),
    })
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('add-rack-btn')
    await user.click(screen.getByTestId('add-rack-btn'))
    await screen.findByTestId('rack-general-page')
  })

  it('"Duplicate" triggers duplicate and navigates to the new rack', async () => {
    routeFetch({
      racksList: () => jsonResponse({ racks: [rack('rack-1', { general: { rackDesignation: 'A' } }, '1')] }),
      duplicate: () => jsonResponse(rack('rack-dup', { general: {} }, '2')),
    })
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('duplicate-rack-rack-1')
    await user.click(screen.getByTestId('duplicate-rack-rack-1'))
    await screen.findByTestId('rack-general-page')
  })
})
