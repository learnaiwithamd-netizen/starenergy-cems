import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { axe } from 'vitest-axe'
import { MachineRoomExhaustPage } from './MachineRoomExhaustPage'

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

const fakeMachineRoomsResponse = {
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

function renderPage(route = '/audit/audit-abc/section/refrigeration/exhaust') {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/audit/:auditId/section/refrigeration/exhaust" element={<MachineRoomExhaustPage />} />
          <Route path="/audit/:auditId/section/refrigeration/racks" element={<div data-testid="racks-page" />} />
          <Route path="/audit/:auditId/section/refrigeration" element={<div data-testid="general-page" />} />
          <Route path="/audit/:auditId" element={<div data-testid="overview-page" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('MachineRoomExhaustPage', () => {
  it('shows skeleton while machine rooms are loading', () => {
    fetchMock.mockImplementation(() => new Promise(() => {}))
    renderPage()
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull()
  })

  it('shows error alert when GET fails', async () => {
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

  it('renders exhaust form after loading', async () => {
    fetchMock.mockResolvedValue(jsonResponse(fakeMachineRoomsResponse))
    renderPage()
    await screen.findByText('Machine Room — Exhaust')
    expect(screen.getByTestId('exhaust-type')).toBeDefined()
    expect(screen.getByTestId('comment-field')).toBeDefined()
  })

  it('Natural selection hides the conditional Forced-only fields', async () => {
    fetchMock.mockResolvedValue(jsonResponse(fakeMachineRoomsResponse))
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('exhaust-type')

    await user.click(screen.getByTestId('exhaust-type'))
    await user.click(await screen.findByRole('option', { name: 'Natural' }))

    await waitFor(() => {
      expect(screen.queryByTestId('qty-fans')).toBeNull()
      expect(screen.queryByTestId('set-point-on')).toBeNull()
      expect(screen.queryByTestId('control-by')).toBeNull()
    })
  })

  it('Forced selection shows the conditional fields', async () => {
    fetchMock.mockResolvedValue(jsonResponse(fakeMachineRoomsResponse))
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('exhaust-type')

    await user.click(screen.getByTestId('exhaust-type'))
    await user.click(await screen.findByRole('option', { name: 'Forced' }))

    await waitFor(() => {
      expect(screen.getByTestId('qty-fans')).toBeDefined()
      expect(screen.getByTestId('hp-motor')).toBeDefined()
      expect(screen.getByTestId('power-rating')).toBeDefined()
      expect(screen.getByTestId('set-point-on')).toBeDefined()
      expect(screen.getByTestId('set-point-off')).toBeDefined()
      expect(screen.getByTestId('control-by')).toBeDefined()
    })
  })

  it('cross-field: Set point OFF >= ON with Forced shows error and blocks Next', async () => {
    fetchMock.mockResolvedValue(jsonResponse(fakeMachineRoomsResponse))
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('exhaust-type')

    await user.click(screen.getByTestId('exhaust-type'))
    await user.click(await screen.findByRole('option', { name: 'Forced' }))
    await screen.findByTestId('set-point-on')

    await user.type(screen.getByTestId('set-point-on'), '50')
    await user.type(screen.getByTestId('set-point-off'), '60')
    await user.click(screen.getByTestId('next-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('setpoint-off-error').textContent).toContain(
        'OFF set point must be lower than ON set point',
      )
    })
    expect(screen.queryByTestId('racks-page')).toBeNull()
  })

  it('empty Exhaust Type blocks navigation and shows error count', async () => {
    fetchMock.mockResolvedValue(jsonResponse(fakeMachineRoomsResponse))
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('next-btn')
    await user.click(screen.getByTestId('next-btn'))
    await waitFor(() => {
      expect(screen.getByTestId('next-btn').textContent).toContain('remaining')
    })
    expect(screen.queryByTestId('racks-page')).toBeNull()
  })

  it('valid submit navigates to racks URL', async () => {
    fetchMock.mockResolvedValue(jsonResponse(fakeMachineRoomsResponse))
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('exhaust-type')

    await user.click(screen.getByTestId('exhaust-type'))
    await user.click(await screen.findByRole('option', { name: 'Natural' }))

    fetchMock.mockResolvedValue(jsonResponse({ savedAt: '2026-05-16T10:00:00.000Z', roomId: 'mr-1' }))
    await user.click(screen.getByTestId('next-btn'))

    await screen.findByTestId('racks-page')
  })

  it('passes axe accessibility scan', async () => {
    fetchMock.mockResolvedValue(jsonResponse(fakeMachineRoomsResponse))
    const { container } = renderPage()
    await screen.findByText('Machine Room — Exhaust')
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
