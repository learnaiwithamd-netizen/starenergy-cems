import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { axe } from 'vitest-axe'
import { MachineRoomVentilationPage } from './MachineRoomVentilationPage'

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

function renderPage(route = '/audit/audit-abc/section/refrigeration/ventilation') {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/audit/:auditId/section/refrigeration/ventilation" element={<MachineRoomVentilationPage />} />
          <Route path="/audit/:auditId/section/refrigeration/exhaust" element={<div data-testid="exhaust-page" />} />
          <Route path="/audit/:auditId/section/refrigeration" element={<div data-testid="general-page" />} />
          <Route path="/audit/:auditId" element={<div data-testid="overview-page" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('MachineRoomVentilationPage', () => {
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

  it('renders ventilation form after loading', async () => {
    fetchMock.mockResolvedValue(jsonResponse(fakeMachineRoomsResponse))
    renderPage()
    await screen.findByText('Machine Room — Ventilation')
    expect(screen.getByTestId('vent-type')).toBeDefined()
    expect(screen.getByTestId('connected-exhaust')).toBeDefined()
  })

  it('Natural selection hides Set point ON/OFF and Control by fields', async () => {
    fetchMock.mockResolvedValue(jsonResponse(fakeMachineRoomsResponse))
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('vent-type')

    // Open the ventilation type select and pick Natural
    await user.click(screen.getByTestId('vent-type'))
    const naturalOption = await screen.findByRole('option', { name: 'Natural' })
    await user.click(naturalOption)

    await waitFor(() => {
      expect(screen.queryByTestId('set-point-on')).toBeNull()
      expect(screen.queryByTestId('set-point-off')).toBeNull()
      expect(screen.queryByTestId('control-by')).toBeNull()
    })
  })

  it('Forced selection shows Set point ON/OFF and Control by fields', async () => {
    fetchMock.mockResolvedValue(jsonResponse(fakeMachineRoomsResponse))
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('vent-type')

    await user.click(screen.getByTestId('vent-type'))
    const forcedOption = await screen.findByRole('option', { name: 'Forced' })
    await user.click(forcedOption)

    await waitFor(() => {
      expect(screen.getByTestId('set-point-on')).toBeDefined()
      expect(screen.getByTestId('set-point-off')).toBeDefined()
      expect(screen.getByTestId('control-by')).toBeDefined()
    })
  })

  it('cross-field: Set point OFF >= ON with Forced shows error', async () => {
    fetchMock.mockResolvedValue(jsonResponse(fakeMachineRoomsResponse))
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('vent-type')

    // Select Forced
    await user.click(screen.getByTestId('vent-type'))
    await user.click(await screen.findByRole('option', { name: 'Forced' }))
    await screen.findByTestId('set-point-on')

    // Enter ON=50, OFF=60 (OFF > ON — invalid)
    await user.type(screen.getByTestId('set-point-on'), '50')
    await user.type(screen.getByTestId('set-point-off'), '60')

    await user.click(screen.getByTestId('next-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('setpoint-off-error')).toBeDefined()
      expect(screen.getByTestId('setpoint-off-error').textContent).toContain(
        'OFF set point must be lower than ON set point',
      )
    })
    expect(screen.queryByTestId('exhaust-page')).toBeNull()
  })

  it('required Ventilation Type empty -> Next tap shows error count in label', async () => {
    fetchMock.mockResolvedValue(jsonResponse(fakeMachineRoomsResponse))
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('next-btn')
    await user.click(screen.getByTestId('next-btn'))
    await waitFor(() => {
      expect(screen.getByTestId('next-btn').textContent).toContain('remaining')
    })
    expect(screen.queryByTestId('exhaust-page')).toBeNull()
  })

  it('valid submit navigates to exhaust URL', async () => {
    fetchMock.mockResolvedValue(jsonResponse(fakeMachineRoomsResponse))
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('vent-type')

    // Select Natural (no further required fields)
    await user.click(screen.getByTestId('vent-type'))
    await user.click(await screen.findByRole('option', { name: 'Natural' }))

    fetchMock.mockResolvedValue(jsonResponse({ savedAt: '2026-05-16T10:00:00.000Z', roomId: 'mr-1' }))
    await user.click(screen.getByTestId('next-btn'))

    await screen.findByTestId('exhaust-page')
  })

  it('passes axe accessibility scan', async () => {
    fetchMock.mockResolvedValue(jsonResponse(fakeMachineRoomsResponse))
    const { container } = renderPage()
    await screen.findByText('Machine Room — Ventilation')
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
