import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { axe } from 'vitest-axe'
import { CompressorListPage } from './CompressorListPage'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const machineRoomsResponse = {
  machineRooms: [
    { id: 'mr-1', auditId: 'audit-abc', roomNumber: '1', data: {}, createdAt: 'x', updatedAt: 'x' },
  ],
}

const rackResponse = {
  id: 'rack-1',
  tenantId: 'tenant-a',
  machineRoomId: 'mr-1',
  rackNumber: '2',
  data: {},
  createdAt: 'x',
  updatedAt: 'x',
}

function compressor(id: string, data: Record<string, unknown>, compressorNumber = '1') {
  return {
    id,
    tenantId: 'tenant-a',
    rackId: 'rack-1',
    compressorNumber,
    compressorRefId: null,
    data,
    createdAt: 'x',
    updatedAt: 'x',
  }
}

/** Route fetch calls by URL + method. Order matters: most-specific suffixes first. */
function routeFetch(handlers: {
  rooms?: () => Response
  rack?: () => Response
  list?: () => Response
  create?: () => Response
  duplicate?: () => Response
}) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    if (url.endsWith('/machine-rooms'))
      return Promise.resolve((handlers.rooms ?? (() => jsonResponse(machineRoomsResponse)))())
    if (url.includes('/duplicate'))
      return Promise.resolve((handlers.duplicate ?? (() => jsonResponse(compressor('comp-dup', {}))))())
    if (url.endsWith('/compressors') && method === 'POST')
      return Promise.resolve((handlers.create ?? (() => jsonResponse(compressor('comp-new', {}))))())
    if (url.endsWith('/compressors'))
      return Promise.resolve((handlers.list ?? (() => jsonResponse({ compressors: [] })))())
    // single rack lookup (.../racks/rack-1) — must come after /compressors checks
    if (url.includes('/racks/')) return Promise.resolve((handlers.rack ?? (() => jsonResponse(rackResponse)))())
    return Promise.resolve(jsonResponse({}, 404))
  })
}

function renderPage(route = '/audit/audit-abc/section/refrigeration/rack/rack-1/compressors') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route
            path="/audit/:auditId/section/refrigeration/rack/:rackId/compressors"
            element={<CompressorListPage />}
          />
          <Route
            path="/audit/:auditId/section/refrigeration/rack/:rackId/compressor/:compressorId"
            element={<div data-testid="compressor-entry-page" />}
          />
          <Route
            path="/audit/:auditId/section/refrigeration/rack/:rackId/condenser"
            element={<div data-testid="condenser-page" />}
          />
          <Route path="/audit/:auditId/section/refrigeration" element={<div data-testid="general-page" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CompressorListPage', () => {
  it('shows skeleton while loading', () => {
    fetchMock.mockImplementation(() => new Promise(() => {}))
    renderPage()
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull()
  })

  it('shows error alert when machine rooms GET fails', async () => {
    routeFetch({ rooms: () => jsonResponse({ detail: 'fail' }, 500) })
    renderPage()
    await screen.findByRole('alert')
    expect(screen.getByRole('alert').textContent).toContain('Could not load compressors')
  })

  it('renders compressor list with status chips', async () => {
    routeFetch({
      list: () =>
        jsonResponse({
          compressors: [
            compressor('comp-1', { general: { modelNumber: 'ZB45' } }, '1'),
            compressor('comp-2', {}, '2'),
          ],
        }),
    })
    renderPage()
    await screen.findByTestId('compressor-list')
    expect(screen.getByTestId('compressor-card-comp-1')).toBeDefined()
    expect(screen.getByTestId('compressor-card-comp-2')).toBeDefined()
  })

  it('"Not Started" compressor shows the correct chip', async () => {
    routeFetch({ list: () => jsonResponse({ compressors: [compressor('comp-2', {}, '2')] }) })
    renderPage()
    const chip = await screen.findByTestId('compressor-status-comp-2')
    expect(chip.textContent).toBe('Not Started')
  })

  it('"Complete" compressor shows the correct chip', async () => {
    routeFetch({
      list: () => jsonResponse({ compressors: [compressor('comp-1', { general: { modelNumber: 'ZB45' } }, '1')] }),
    })
    renderPage()
    const chip = await screen.findByTestId('compressor-status-comp-1')
    expect(chip.textContent).toBe('Complete')
  })

  it('"Add Compressor" triggers create and navigates to the new compressor', async () => {
    routeFetch({ list: () => jsonResponse({ compressors: [] }), create: () => jsonResponse(compressor('comp-new', {})) })
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('add-compressor-btn')
    await user.click(screen.getByTestId('add-compressor-btn'))
    await screen.findByTestId('compressor-entry-page')
  })

  it('"Duplicate" triggers duplicate and navigates to the new compressor', async () => {
    routeFetch({
      list: () => jsonResponse({ compressors: [compressor('comp-1', { general: { modelNumber: 'ZB45' } }, '1')] }),
      duplicate: () => jsonResponse(compressor('comp-dup', { general: { modelNumber: 'ZB45' } }, '2')),
    })
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('duplicate-compressor-comp-1')
    await user.click(screen.getByTestId('duplicate-compressor-comp-1'))
    await screen.findByTestId('compressor-entry-page')
  })

  it('"Next" navigates to the condenser screen', async () => {
    routeFetch({ list: () => jsonResponse({ compressors: [] }) })
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('next-btn')
    await user.click(screen.getByTestId('next-btn'))
    await screen.findByTestId('condenser-page')
  })

  it('passes axe accessibility scan', async () => {
    routeFetch({
      list: () =>
        jsonResponse({
          compressors: [
            compressor('comp-1', { general: { modelNumber: 'ZB45' } }, '1'),
            compressor('comp-2', {}, '2'),
          ],
        }),
    })
    const { container } = renderPage()
    await screen.findByTestId('compressor-list')
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
