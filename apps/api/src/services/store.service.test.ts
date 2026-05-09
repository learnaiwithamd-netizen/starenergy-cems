import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UserRole } from '@cems/types'

const { fakeTx, repoMock, redisMock } = vi.hoisted(() => ({
  fakeTx: Symbol('fake-tx'),
  repoMock: { listStores: vi.fn(), getStoreByStoreNumber: vi.fn() },
  redisMock: { get: vi.fn(), set: vi.fn() },
}))
vi.mock('../repositories/store.repo.js', () => repoMock)
vi.mock('../lib/redis.js', () => ({
  getRedisConnection: () => redisMock,
}))

import { listStoresForCaller, getStoreDetail } from './store.service.js'

interface FakeRequest {
  rlsContext: {
    tenantId: string
    userId: string
    role: UserRole
    assignedStoreIds: readonly string[]
  } | null
  withRls: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T>
}

function fakeRequest(role: UserRole, assignedStoreIds: readonly string[] = []): FakeRequest {
  return {
    rlsContext: { tenantId: 'tenant-a', userId: 'user-1', role, assignedStoreIds },
    withRls: <T>(fn: (tx: unknown) => Promise<T>) => fn(fakeTx),
  }
}

const sampleDetail = {
  id: 's-1',
  storeNumber: 'STORE-001',
  storeName: 'Sobeys A',
  address: '123 Main St, Toronto, ON M1A 1A1',
  banner: 'Sobeys',
  region: 'ON',
  postalCode: 'M1A 1A1',
  operatingHours: 'Mon-Sun 7am-11pm',
  serviceProviders: ['HVAC Co'],
  storeManager: 'Jane Doe',
}

describe('store.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    repoMock.listStores.mockResolvedValue({ stores: [], total: 0 })
    redisMock.get.mockResolvedValue(null)
    redisMock.set.mockResolvedValue('OK')
  })
  afterEach(() => {
    vi.clearAllMocks()
    delete process.env['GOOGLE_MAPS_API_KEY']
  })

  describe('listStoresForCaller', () => {
    it('ADMIN — ignores assignedToUser=true; returns all stores in tenant', async () => {
      const req = fakeRequest(UserRole.ADMIN, ['ignored'])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await listStoresForCaller({ assignedToUser: true }, { request: req as any })

      expect(repoMock.listStores).toHaveBeenCalledOnce()
      // No `ids` filter → tenant-wide list.
      const arg = repoMock.listStores.mock.calls[0]![1]
      expect(arg).toBeUndefined()
    })

    it('AUDITOR + assignedToUser=true → filters by rlsContext.assignedStoreIds', async () => {
      const req = fakeRequest(UserRole.AUDITOR, ['a', 'b'])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await listStoresForCaller({ assignedToUser: true }, { request: req as any })

      expect(repoMock.listStores).toHaveBeenCalledWith(fakeTx, { ids: ['a', 'b'] })
    })

    it('CLIENT + assignedToUser=true → filters by rlsContext.assignedStoreIds', async () => {
      const req = fakeRequest(UserRole.CLIENT, ['c1', 'c2'])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await listStoresForCaller({ assignedToUser: true }, { request: req as any })

      expect(repoMock.listStores).toHaveBeenCalledWith(fakeTx, { ids: ['c1', 'c2'] })
    })

    it('AUDITOR with empty assignedStoreIds + assignedToUser=true → empty filter (repo short-circuits)', async () => {
      const req = fakeRequest(UserRole.AUDITOR, [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await listStoresForCaller({ assignedToUser: true }, { request: req as any })

      // The service still passes through to the repo; the REPO short-circuits.
      expect(repoMock.listStores).toHaveBeenCalledWith(fakeTx, { ids: [] })
    })

    it('AUDITOR + assignedToUser=false → returns full tenant list', async () => {
      const req = fakeRequest(UserRole.AUDITOR, ['a'])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await listStoresForCaller({ assignedToUser: false }, { request: req as any })

      // No `ids` arg.
      expect(repoMock.listStores.mock.calls[0]![1]).toBeUndefined()
    })

    it('search param is currently a no-op at the API layer (Story 2.1 design)', async () => {
      const req = fakeRequest(UserRole.AUDITOR, ['a'])
      await listStoresForCaller(
        { assignedToUser: true, search: 'sobeys' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { request: req as any },
      )
      // Search arg never reaches the repo.
      const arg = repoMock.listStores.mock.calls[0]![1]
      expect(arg).toEqual({ ids: ['a'] })
    })
  })

  describe('getStoreDetail', () => {
    it('returns cached result without hitting the DB', async () => {
      redisMock.get.mockResolvedValue(JSON.stringify(sampleDetail))
      const req = fakeRequest(UserRole.AUDITOR)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await getStoreDetail('STORE-001', { request: req as any })
      expect(result).toEqual(sampleDetail)
      expect(repoMock.getStoreByStoreNumber).not.toHaveBeenCalled()
    })

    it('fetches from DB on cache miss, caches the result', async () => {
      redisMock.get.mockResolvedValue(null)
      repoMock.getStoreByStoreNumber.mockResolvedValue(sampleDetail)
      const req = fakeRequest(UserRole.AUDITOR)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await getStoreDetail('STORE-001', { request: req as any })
      expect(result).toEqual(sampleDetail)
      expect(repoMock.getStoreByStoreNumber).toHaveBeenCalledWith(fakeTx, 'STORE-001')
      expect(redisMock.set).toHaveBeenCalledWith(
        'store:detail:tenant-a:STORE-001',
        JSON.stringify(sampleDetail),
        'EX',
        3600,
      )
    })

    it('returns null when store not found in DB', async () => {
      repoMock.getStoreByStoreNumber.mockResolvedValue(null)
      const req = fakeRequest(UserRole.AUDITOR)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await getStoreDetail('STORE-999', { request: req as any })
      expect(result).toBeNull()
      expect(redisMock.set).not.toHaveBeenCalled()
    })

    it('enriches address from Maps when API key is set', async () => {
      process.env['GOOGLE_MAPS_API_KEY'] = 'test-key'
      const storeWithPostal = { ...sampleDetail, address: 'Original Address' }
      repoMock.getStoreByStoreNumber.mockResolvedValue(storeWithPostal)
      vi.stubGlobal(
        'fetch',
        vi.fn(async () =>
          new Response(
            JSON.stringify({
              status: 'OK',
              results: [{ formatted_address: '123 Main St, Toronto, ON M1A 1A1, Canada' }],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
      )
      const req = fakeRequest(UserRole.AUDITOR)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await getStoreDetail('STORE-001', { request: req as any })
      expect(result?.address).toBe('123 Main St, Toronto, ON M1A 1A1, Canada')
      vi.unstubAllGlobals()
    })

    it('falls back to stored address when Maps API fails', async () => {
      process.env['GOOGLE_MAPS_API_KEY'] = 'test-key'
      repoMock.getStoreByStoreNumber.mockResolvedValue(sampleDetail)
      vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })))
      const req = fakeRequest(UserRole.AUDITOR)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await getStoreDetail('STORE-001', { request: req as any })
      expect(result?.address).toBe(sampleDetail.address)
      vi.unstubAllGlobals()
    })
  })
})
