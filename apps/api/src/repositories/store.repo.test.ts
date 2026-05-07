import { describe, it, expect, vi } from 'vitest'
import { listStores } from './store.repo.js'

type AnyArg = Record<string, unknown>

describe('store.repo', () => {
  describe('listStores', () => {
    it('returns rows + total when no id filter', async () => {
      const findMany = vi.fn<(arg: AnyArg) => Promise<unknown[]>>(async () => [
        { id: 'a', storeNumber: 'STORE-001', storeName: 'Sobeys A', banner: 'Sobeys', region: 'ON' },
        { id: 'b', storeNumber: 'STORE-002', storeName: null, banner: null, region: null },
      ])
      const tx = { storeRef: { findMany } }

      const res = await listStores(tx)

      expect(res.stores).toHaveLength(2)
      expect(res.total).toBe(2)
      expect(res.stores[0]).toEqual({
        id: 'a',
        storeNumber: 'STORE-001',
        storeName: 'Sobeys A',
        banner: 'Sobeys',
        region: 'ON',
      })
      const arg = findMany.mock.calls[0]![0]
      expect(arg['where']).toEqual({})
      expect(arg['orderBy']).toEqual({ storeNumber: 'asc' })
      expect(arg['take']).toBe(200)
    })

    it('passes through ids filter', async () => {
      const findMany = vi.fn<(arg: AnyArg) => Promise<unknown[]>>(async () => [])
      const tx = { storeRef: { findMany } }
      await listStores(tx, { ids: ['a', 'b'] })
      const arg = findMany.mock.calls[0]![0]
      expect(arg['where']).toEqual({ id: { in: ['a', 'b'] } })
    })

    it('returns empty without a DB call when ids is []', async () => {
      const findMany = vi.fn(async () => [])
      const tx = { storeRef: { findMany } }
      const res = await listStores(tx, { ids: [] })
      expect(res).toEqual({ stores: [], total: 0 })
      expect(findMany).not.toHaveBeenCalled()
    })

    it('honours custom take', async () => {
      const findMany = vi.fn<(arg: AnyArg) => Promise<unknown[]>>(async () => [])
      const tx = { storeRef: { findMany } }
      await listStores(tx, { take: 25 })
      expect(findMany.mock.calls[0]![0]['take']).toBe(25)
    })
  })
})
