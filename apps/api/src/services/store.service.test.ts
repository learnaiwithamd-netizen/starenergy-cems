import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UserRole } from '@cems/types'

const { fakeTx, repoMock } = vi.hoisted(() => ({
  fakeTx: Symbol('fake-tx'),
  repoMock: { listStores: vi.fn() },
}))
vi.mock('../repositories/store.repo.js', () => repoMock)

import { listStoresForCaller } from './store.service.js'

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

describe('store.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    repoMock.listStores.mockResolvedValue({ stores: [], total: 0 })
  })
  afterEach(() => {
    vi.clearAllMocks()
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
})
