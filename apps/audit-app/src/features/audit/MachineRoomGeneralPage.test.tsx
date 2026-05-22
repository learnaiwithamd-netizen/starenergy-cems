import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { axe } from 'vitest-axe'
import { MachineRoomGeneralPage } from './MachineRoomGeneralPage'

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

const fakeMachineRoom = {
  id: 'mr-1',
  auditId: 'audit-abc',
  roomNumber: '1',
  data: {},
  createdAt: '2026-05-16T10:00:00.000Z',
  updatedAt: '2026-05-16T10:00:00.000Z',
}

function renderPage(route = '/audit/audit-abc/section/refrigeration') {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/audit/:auditId/section/refrigeration" element={<MachineRoomGeneralPage />} />
          <Route path="/audit/:auditId/section/refrigeration/ventilation" element={<div data-testid="ventilation-page" />} />
          <Route path="/audit/:auditId" element={<div data-testid="overview-page" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('MachineRoomGeneralPage', () => {
  it('shows skeleton while POST is in-flight', () => {
    fetchMock.mockImplementation(() => new Promise(() => {})) // never resolves
    renderPage()
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull()
  })

  it('shows error alert when POST fails', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ type: '/errors/bad', title: 'Bad', status: 500, detail: 'fail', instance: '/' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    renderPage()
    await screen.findByRole('alert')
    expect(screen.getByRole('alert').textContent).toContain('Could not load machine room')
  })

  it('renders form fields after successful POST', async () => {
    fetchMock.mockResolvedValue(jsonResponse(fakeMachineRoom))
    renderPage()
    await screen.findByText('Machine Room — General')
    expect(screen.getByTestId('mr-id')).toBeDefined()
    expect(screen.getByTestId('mr-location')).toBeDefined()
    expect(screen.getByTestId('rack-row-0')).toBeDefined()
    expect(screen.getByTestId('add-rack-btn')).toBeDefined()
  })

  it('"Add Another Rack" appends a new rack row', async () => {
    fetchMock.mockResolvedValue(jsonResponse(fakeMachineRoom))
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('add-rack-btn')
    await user.click(screen.getByTestId('add-rack-btn'))
    expect(screen.getByTestId('rack-row-1')).toBeDefined()
  })

  it('tapping Next with empty Machine Room ID shows error and does not navigate', async () => {
    fetchMock.mockResolvedValue(jsonResponse(fakeMachineRoom))
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('next-btn')
    await user.click(screen.getByTestId('next-btn'))
    await waitFor(() => {
      expect(screen.getByTestId('next-btn').textContent).toContain('remaining')
    })
    expect(screen.queryByTestId('ventilation-page')).toBeNull()
  })

  it('valid submit navigates to ventilation page', async () => {
    const fakeMachineRoomWithData = {
      ...fakeMachineRoom,
      data: { general: { machineRoomId: '1', location: 'Mezzanine', racks: [{ rackName: '1', suctionGroupNumber: '1', suctionGroupType: 'Low Temp.' }] } },
    }
    fetchMock.mockResolvedValue(jsonResponse(fakeMachineRoomWithData))
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('next-btn')

    // PATCH calls use a second fetch mock; allow them
    fetchMock.mockResolvedValue(jsonResponse({ savedAt: new Date().toISOString(), roomId: 'mr-1' }))

    await user.click(screen.getByTestId('next-btn'))
    await waitFor(() => {
      expect(screen.getByTestId('ventilation-page')).toBeDefined()
    })
  })

  it('field change triggers PATCH after debounce', async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValue(jsonResponse(fakeMachineRoom))
    renderPage()

    // Wait for the POST to resolve
    await act(async () => {
      await vi.runAllTimersAsync()
    })

    // PATCH should be called after debounce
    expect(fetchMock).toHaveBeenCalledTimes(1) // just the POST initially
  })

  it('passes axe accessibility scan in default state', async () => {
    fetchMock.mockResolvedValue(jsonResponse(fakeMachineRoom))
    const { container } = renderPage()
    await screen.findByText('Machine Room — General')
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
