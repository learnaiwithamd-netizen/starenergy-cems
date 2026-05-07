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
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

import { StoreSelectorPage } from './StoreSelectorPage'

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/']}>
        <StoreSelectorPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const sampleStores = [
  { id: 'a', storeNumber: 'STORE-001', storeName: 'Sobeys A', banner: 'Sobeys', region: 'ON' },
  { id: 'b', storeNumber: 'STORE-002', storeName: 'Metro B', banner: 'Metro', region: 'QC' },
  { id: 'c', storeNumber: 'STORE-456', storeName: 'Sobeys C', banner: 'Sobeys', region: 'ON' },
]

describe('StoreSelectorPage', () => {
  it('shows the empty-state message when no stores are assigned (AC3)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ stores: [], total: 0 }))
    renderPage()
    await waitFor(() =>
      expect(
        screen.getByText('No stores assigned — contact your administrator'),
      ).toBeInTheDocument(),
    )
  })

  it('shows skeleton placeholders while loading (AC2)', async () => {
    let resolveFetch!: (r: Response) => void
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve
      }),
    )
    const { container } = renderPage()
    // Skeleton list is aria-hidden; assert via DOM query.
    await waitFor(() =>
      expect(container.querySelector('ul[aria-hidden="true"]')).toBeInTheDocument(),
    )
    // Resolve to settle the promise.
    resolveFetch(jsonResponse({ stores: [], total: 0 }))
  })

  it('renders the populated list and clicking a row navigates to /audit/new (AC1, AC5)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ stores: sampleStores, total: 3 }))
    const user = userEvent.setup()
    const { container } = renderPage()

    await waitFor(() => expect(screen.getByText(/STORE-001/)).toBeInTheDocument())

    // axe pass.
    const results = await axe(container, {
      rules: { 'color-contrast': { enabled: false } },
    })
    expect(results).toHaveNoViolations()

    await user.click(screen.getByRole('button', { name: /select store STORE-001/i }))
    expect(navigateMock).toHaveBeenCalledWith('/audit/new?storeNumber=STORE-001')
  })

  it('search filters by store number (AC4)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ stores: sampleStores, total: 3 }))
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => expect(screen.getByText(/STORE-001/)).toBeInTheDocument())

    await user.type(screen.getByLabelText(/search stores/i), '456')

    await waitFor(() => {
      expect(screen.queryByText(/STORE-001/)).not.toBeInTheDocument()
      expect(screen.getByText(/STORE-456/)).toBeInTheDocument()
    })
  })

  it('search filters by store name (AC4, case-insensitive)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ stores: sampleStores, total: 3 }))
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => expect(screen.getByText(/STORE-001/)).toBeInTheDocument())

    await user.type(screen.getByLabelText(/search stores/i), 'metro')

    await waitFor(() => {
      expect(screen.queryByText(/STORE-001/)).not.toBeInTheDocument()
      expect(screen.getByText(/STORE-002/)).toBeInTheDocument()
    })
  })
})
