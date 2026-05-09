import { describe, it, expect, vi } from 'vitest'
import { listStores, getStoreByStoreNumber } from './store.repo.js'

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

  describe('getStoreByStoreNumber', () => {
    const fullRow = {
      id: 's-1',
      storeNumber: 'STORE-001',
      storeName: 'Sobeys A',
      address: '123 Main St',
      banner: 'Sobeys',
      region: 'ON',
      postalCode: 'M1A 1A1',
      operatingHours: 'Mon-Sun 7am-11pm',
      serviceProviders: JSON.stringify(['HVAC Co', 'Refrigeration Inc']),
      storeManager: 'Jane Doe',
    }

    it('returns full store detail when found', async () => {
      const findFirst = vi.fn<(arg: AnyArg) => Promise<typeof fullRow | null>>(async () => fullRow)
      const tx = { storeRef: { findFirst } }
      const result = await getStoreByStoreNumber(tx, 'STORE-001')
      expect(result).toEqual({
        id: 's-1',
        storeNumber: 'STORE-001',
        storeName: 'Sobeys A',
        address: '123 Main St',
        banner: 'Sobeys',
        region: 'ON',
        postalCode: 'M1A 1A1',
        operatingHours: 'Mon-Sun 7am-11pm',
        serviceProviders: ['HVAC Co', 'Refrigeration Inc'],
        storeManager: 'Jane Doe',
      })
      expect(findFirst.mock.calls[0]![0]).toMatchObject({ where: { storeNumber: 'STORE-001' } })
    })

    it('parses serviceProviders JSON string into array', async () => {
      const findFirst = vi.fn<(arg: AnyArg) => Promise<typeof fullRow | null>>(async () => ({ ...fullRow, serviceProviders: '["A","B"]' }))
      const tx = { storeRef: { findFirst } }
      const result = await getStoreByStoreNumber(tx, 'STORE-001')
      expect(result?.serviceProviders).toEqual(['A', 'B'])
    })

    it('returns empty serviceProviders array when field is null', async () => {
      const findFirst = vi.fn<(arg: AnyArg) => Promise<AnyArg | null>>(async () => ({ ...fullRow, serviceProviders: null }))
      const tx = { storeRef: { findFirst } }
      const result = await getStoreByStoreNumber(tx, 'STORE-001')
      expect(result?.serviceProviders).toEqual([])
    })

    it('returns null when store not found', async () => {
      const findFirst = vi.fn<(arg: AnyArg) => Promise<AnyArg | null>>(async () => null)
      const tx = { storeRef: { findFirst } }
      const result = await getStoreByStoreNumber(tx, 'STORE-999')
      expect(result).toBeNull()
    })
  })
})
