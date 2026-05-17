import { describe, it, expect, vi } from 'vitest'
import {
  createMachineRoom,
  getMachineRoomsByAuditId,
  getMachineRoomById,
  upsertMachineRoomData,
} from './machine-room.repo.js'
import { MachineRoomNotFoundError } from '../lib/audit-errors.js'

type AnyArg = Record<string, unknown>

const now = new Date('2026-05-16T10:00:00Z')

function makeRow(overrides: Partial<AnyArg> = {}) {
  return {
    id: 'mr-1',
    tenantId: 'tenant-a',
    auditId: 'audit-1',
    roomNumber: '1',
    data: '{}',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('machine-room.repo', () => {
  describe('createMachineRoom', () => {
    it('calls machineRoom.create with correct args and returns parsed room', async () => {
      const create = vi.fn(async () => makeRow())
      const upsert = vi.fn(async () => ({}))
      const update = vi.fn(async () => ({ currentSectionId: 'refrigeration' }))
      const tx = { machineRoom: { create }, auditSection: { upsert }, audit: { update } }

      const result = await createMachineRoom(tx, { tenantId: 'tenant-a', auditId: 'audit-1', roomNumber: '1' })

      expect(create).toHaveBeenCalledWith({
        data: { tenantId: 'tenant-a', auditId: 'audit-1', roomNumber: '1', data: '{}' },
      })
      expect(result.id).toBe('mr-1')
      expect(result.data).toEqual({})
      expect(result.createdAt).toBe(now.toISOString())
    })

    it('upserts audit_sections row for refrigeration', async () => {
      const create = vi.fn(async () => makeRow())
      const upsert = vi.fn(async () => ({}))
      const update = vi.fn(async () => ({}))
      const tx = { machineRoom: { create }, auditSection: { upsert }, audit: { update } }

      await createMachineRoom(tx, { tenantId: 'tenant-a', auditId: 'audit-1', roomNumber: '1' })

      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { auditId_sectionId: { auditId: 'audit-1', sectionId: 'refrigeration' } },
        }),
      )
    })

    it('updates audit.currentSectionId to refrigeration', async () => {
      const create = vi.fn(async () => makeRow())
      const upsert = vi.fn(async () => ({}))
      const update = vi.fn(async () => ({}))
      const tx = { machineRoom: { create }, auditSection: { upsert }, audit: { update } }

      await createMachineRoom(tx, { tenantId: 'tenant-a', auditId: 'audit-1', roomNumber: '1' })

      expect(update).toHaveBeenCalledWith({
        where: { id: 'audit-1' },
        data: { currentSectionId: 'refrigeration' },
      })
    })

    it('parses non-empty JSON data', async () => {
      const create = vi.fn(async () => makeRow({ data: JSON.stringify({ general: { machineRoomId: '1' } }) }))
      const upsert = vi.fn(async () => ({}))
      const update = vi.fn(async () => ({}))
      const tx = { machineRoom: { create }, auditSection: { upsert }, audit: { update } }

      const result = await createMachineRoom(tx, { tenantId: 'tenant-a', auditId: 'audit-1', roomNumber: '1' })

      expect(result.data).toEqual({ general: { machineRoomId: '1' } })
    })
  })

  describe('getMachineRoomsByAuditId', () => {
    it('returns empty array when no rooms exist', async () => {
      const findMany = vi.fn(async () => [])
      const tx = { machineRoom: { findMany } }
      const result = await getMachineRoomsByAuditId(tx, { auditId: 'audit-1' })
      expect(result).toEqual([])
    })

    it('returns mapped array with parsed data', async () => {
      const rows = [makeRow(), makeRow({ id: 'mr-2', roomNumber: '2', data: JSON.stringify({ x: 1 }) })]
      const findMany = vi.fn(async () => rows)
      const tx = { machineRoom: { findMany } }

      const result = await getMachineRoomsByAuditId(tx, { auditId: 'audit-1' })

      expect(result).toHaveLength(2)
      expect(result[0]!.id).toBe('mr-1')
      expect(result[1]!.data).toEqual({ x: 1 })
    })

    it('queries by auditId with asc createdAt order', async () => {
      const findMany = vi.fn<(arg: AnyArg) => Promise<unknown[]>>(async () => [])
      const tx = { machineRoom: { findMany } }
      await getMachineRoomsByAuditId(tx, { auditId: 'audit-1' })
      expect(findMany.mock.calls[0]![0]).toEqual({ where: { auditId: 'audit-1' }, orderBy: { createdAt: 'asc' } })
    })
  })

  describe('getMachineRoomById', () => {
    it('returns null when not found', async () => {
      const findUnique = vi.fn(async () => null)
      const tx = { machineRoom: { findUnique } }
      const result = await getMachineRoomById(tx, { id: 'mr-x' })
      expect(result).toBeNull()
    })

    it('returns mapped room when found', async () => {
      const findUnique = vi.fn(async () => makeRow())
      const tx = { machineRoom: { findUnique } }
      const result = await getMachineRoomById(tx, { id: 'mr-1' })
      expect(result!.id).toBe('mr-1')
    })
  })

  describe('upsertMachineRoomData', () => {
    it('updates machine room, upserts audit_sections, and updates audit', async () => {
      const update = vi.fn<(arg: AnyArg) => Promise<{ updatedAt: Date } | unknown>>(
        (arg: AnyArg) => {
          if ((arg as { where: AnyArg }).where?.id) return Promise.resolve({ updatedAt: now })
          return Promise.resolve({})
        },
      )
      const upsert = vi.fn(async () => ({}))
      const findFirst = vi.fn(async () => null)
      const tx = { machineRoom: { update }, auditSection: { upsert, findFirst }, audit: { update } }

      const result = await upsertMachineRoomData(tx, {
        id: 'mr-1',
        auditId: 'audit-1',
        tenantId: 'tenant-a',
        data: { general: { machineRoomId: '1' } },
      })

      expect(result.roomId).toBe('mr-1')
      expect(result.savedAt).toBe(now.toISOString())
      // machineRoom.update called first (P2 fix: WHERE includes auditId)
      expect((update.mock.calls[0]![0] as AnyArg)['where']).toEqual({ id: 'mr-1', auditId: 'audit-1' })
      expect((update.mock.calls[0]![0] as AnyArg)['data']).toEqual({
        data: JSON.stringify({ general: { machineRoomId: '1' } }),
      })
      // auditSection.upsert called next
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { auditId_sectionId: { auditId: 'audit-1', sectionId: 'refrigeration' } },
        }),
      )
      // audit.update called last
      expect((update.mock.calls[1]![0] as AnyArg)['where']).toEqual({ id: 'audit-1' })
    })

    it('throws MachineRoomNotFoundError on P2025', async () => {
      const p2025 = Object.assign(new Error('Record not found'), { code: 'P2025' })
      const update = vi.fn(async () => { throw p2025 })
      const upsert = vi.fn()
      const tx = { machineRoom: { update }, auditSection: { upsert }, audit: { update } }

      await expect(
        upsertMachineRoomData(tx, { id: 'missing', auditId: 'audit-1', tenantId: 'tenant-a', data: {} }),
      ).rejects.toBeInstanceOf(MachineRoomNotFoundError)
    })
  })
})
