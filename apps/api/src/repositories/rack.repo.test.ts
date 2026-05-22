import { describe, it, expect, vi } from 'vitest'
import {
  createRack,
  getRacksByMachineRoomId,
  getRackById,
  upsertRackData,
  duplicateRack,
} from './rack.repo.js'
import { RackNotFoundError } from '../lib/audit-errors.js'

type AnyArg = Record<string, unknown>

const now = new Date('2026-05-16T10:00:00Z')

function makeRow(overrides: Partial<AnyArg> = {}) {
  return {
    id: 'rack-1',
    tenantId: 'tenant-a',
    machineRoomId: 'mr-1',
    rackNumber: '1',
    data: '{}',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('rack.repo', () => {
  describe('createRack', () => {
    it('calls rack.create with correct args and returns parsed rack', async () => {
      const create = vi.fn(async () => makeRow())
      const tx = { rack: { create } }

      const result = await createRack(tx, {
        tenantId: 'tenant-a',
        machineRoomId: 'mr-1',
        rackNumber: '1',
      })

      expect(create).toHaveBeenCalledWith({
        data: { tenantId: 'tenant-a', machineRoomId: 'mr-1', rackNumber: '1', data: '{}' },
      })
      expect(result.id).toBe('rack-1')
      expect(result.data).toEqual({})
      expect(result.createdAt).toBe(now.toISOString())
    })

    it('serializes provided data blob', async () => {
      const create = vi.fn<(arg: AnyArg) => Promise<unknown>>(
        async () => makeRow({ data: JSON.stringify({ general: { rackType: 'Low Temperature' } }) }),
      )
      const tx = { rack: { create } }

      const result = await createRack(tx, {
        tenantId: 'tenant-a',
        machineRoomId: 'mr-1',
        rackNumber: '2',
        data: { general: { rackType: 'Low Temperature' } },
      })

      expect((create.mock.calls[0]![0] as AnyArg)['data']).toMatchObject({
        data: JSON.stringify({ general: { rackType: 'Low Temperature' } }),
      })
      expect(result.data).toEqual({ general: { rackType: 'Low Temperature' } })
    })
  })

  describe('getRacksByMachineRoomId', () => {
    it('returns empty array when no racks exist', async () => {
      const findMany = vi.fn(async () => [])
      const tx = { rack: { findMany } }
      const result = await getRacksByMachineRoomId(tx, { machineRoomId: 'mr-1' })
      expect(result).toEqual([])
    })

    it('returns mapped array and queries by machineRoomId with asc order', async () => {
      const rows = [makeRow(), makeRow({ id: 'rack-2', rackNumber: '2', data: JSON.stringify({ x: 1 }) })]
      const findMany = vi.fn<(arg: AnyArg) => Promise<unknown[]>>(async () => rows)
      const tx = { rack: { findMany } }

      const result = await getRacksByMachineRoomId(tx, { machineRoomId: 'mr-1' })

      expect(result).toHaveLength(2)
      expect(result[1]!.data).toEqual({ x: 1 })
      expect(findMany.mock.calls[0]![0]).toEqual({
        where: { machineRoomId: 'mr-1' },
        orderBy: { createdAt: 'asc' },
      })
    })
  })

  describe('getRackById', () => {
    it('returns null when not found', async () => {
      const findUnique = vi.fn(async () => null)
      const tx = { rack: { findUnique } }
      const result = await getRackById(tx, { id: 'rack-x' })
      expect(result).toBeNull()
    })

    it('returns mapped rack when found', async () => {
      const findUnique = vi.fn(async () => makeRow())
      const tx = { rack: { findUnique } }
      const result = await getRackById(tx, { id: 'rack-1' })
      expect(result!.id).toBe('rack-1')
    })
  })

  describe('upsertRackData', () => {
    it('updates rack data with machineRoomId in WHERE (cross-room guard)', async () => {
      const findFirst = vi.fn(async () => ({ data: '{}' }))
      const update = vi.fn<(arg: AnyArg) => Promise<unknown>>(async () => ({ updatedAt: now }))
      const tx = { rack: { findFirst, update } }

      const result = await upsertRackData(tx, {
        id: 'rack-1',
        machineRoomId: 'mr-1',
        tenantId: 'tenant-a',
        data: { general: { rackDesignation: 'A' } },
      })

      expect(result).toEqual({ savedAt: now.toISOString(), rackId: 'rack-1' })
      expect((update.mock.calls[0]![0] as AnyArg)['where']).toEqual({ id: 'rack-1', machineRoomId: 'mr-1' })
      expect((update.mock.calls[0]![0] as AnyArg)['data']).toEqual({
        data: JSON.stringify({ general: { rackDesignation: 'A' } }),
      })
    })

    it('shallow-merges the incoming sub-key with existing data (no clobber)', async () => {
      const findFirst = vi.fn(async () => ({ data: JSON.stringify({ pipeHeaders: { count: 2 } }) }))
      const update = vi.fn<(arg: AnyArg) => Promise<unknown>>(async () => ({ updatedAt: now }))
      const tx = { rack: { findFirst, update } }

      await upsertRackData(tx, {
        id: 'rack-1',
        machineRoomId: 'mr-1',
        tenantId: 'tenant-a',
        data: { general: { rackDesignation: 'A' } },
      })

      const written = JSON.parse(
        (update.mock.calls[0]![0] as { data: { data: string } }).data.data,
      ) as Record<string, unknown>
      expect(written).toEqual({ pipeHeaders: { count: 2 }, general: { rackDesignation: 'A' } })
    })

    it('handles empty data object', async () => {
      const findFirst = vi.fn(async () => ({ data: '{}' }))
      const update = vi.fn<(arg: AnyArg) => Promise<unknown>>(async () => ({ updatedAt: now }))
      const tx = { rack: { findFirst, update } }

      const result = await upsertRackData(tx, {
        id: 'rack-1',
        machineRoomId: 'mr-1',
        tenantId: 'tenant-a',
        data: {},
      })

      expect((update.mock.calls[0]![0] as AnyArg)['data']).toEqual({ data: '{}' })
      expect(result.rackId).toBe('rack-1')
    })

    it('throws RackNotFoundError when the rack is missing (read returns null)', async () => {
      const findFirst = vi.fn(async () => null)
      const tx = { rack: { findFirst, update: vi.fn() } }

      await expect(
        upsertRackData(tx, { id: 'missing', machineRoomId: 'mr-1', tenantId: 'tenant-a', data: {} }),
      ).rejects.toBeInstanceOf(RackNotFoundError)
    })

    it('throws RackNotFoundError on P2025', async () => {
      const p2025 = Object.assign(new Error('Record not found'), { code: 'P2025' })
      const findFirst = vi.fn(async () => ({ data: '{}' }))
      const update = vi.fn(async () => { throw p2025 })
      const tx = { rack: { findFirst, update } }

      await expect(
        upsertRackData(tx, { id: 'missing', machineRoomId: 'mr-1', tenantId: 'tenant-a', data: {} }),
      ).rejects.toBeInstanceOf(RackNotFoundError)
    })
  })

  describe('duplicateRack', () => {
    it('copies source data but clears data.general.rackDesignation', async () => {
      const source = makeRow({
        id: 'rack-1',
        data: JSON.stringify({
          general: { rackDesignation: 'A', rackType: 'Low Temperature', rackMake: 'Bohn' },
        }),
      })
      const findUnique = vi.fn(async () => source)
      const create = vi.fn<(arg: AnyArg) => Promise<unknown>>(
        async () => makeRow({ id: 'rack-2', rackNumber: '2' }),
      )
      const tx = { rack: { findUnique, create } }

      const result = await duplicateRack(tx, {
        sourceId: 'rack-1',
        machineRoomId: 'mr-1',
        tenantId: 'tenant-a',
        rackNumber: '2',
      })

      const createdData = JSON.parse((create.mock.calls[0]![0] as { data: { data: string } }).data.data) as {
        general: Record<string, unknown>
      }
      expect(createdData.general).toEqual({ rackType: 'Low Temperature', rackMake: 'Bohn' })
      expect(createdData.general['rackDesignation']).toBeUndefined()
      expect(result.id).toBe('rack-2')
    })

    it('throws RackNotFoundError when source rack belongs to a different machine room', async () => {
      const source = makeRow({ machineRoomId: 'mr-other' })
      const findUnique = vi.fn(async () => source)
      const create = vi.fn()
      const tx = { rack: { findUnique, create } }

      await expect(
        duplicateRack(tx, { sourceId: 'rack-1', machineRoomId: 'mr-1', tenantId: 'tenant-a', rackNumber: '2' }),
      ).rejects.toBeInstanceOf(RackNotFoundError)
      expect(create).not.toHaveBeenCalled()
    })

    it('throws RackNotFoundError when source rack missing', async () => {
      const findUnique = vi.fn(async () => null)
      const tx = { rack: { findUnique, create: vi.fn() } }

      await expect(
        duplicateRack(tx, { sourceId: 'gone', machineRoomId: 'mr-1', tenantId: 'tenant-a', rackNumber: '2' }),
      ).rejects.toBeInstanceOf(RackNotFoundError)
    })
  })
})
