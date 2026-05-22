import { describe, it, expect, vi } from 'vitest'
import {
  createCompressor,
  getCompressorsByRackId,
  getCompressorById,
  upsertCompressorData,
  duplicateCompressor,
} from './compressor.repo.js'
import { CompressorNotFoundError } from '../lib/audit-errors.js'

type AnyArg = Record<string, unknown>

const now = new Date('2026-05-22T10:00:00Z')

function makeRow(overrides: Partial<AnyArg> = {}) {
  return {
    id: 'comp-1',
    tenantId: 'tenant-a',
    rackId: 'rack-1',
    compressorNumber: '1',
    compressorRefId: null,
    data: '{}',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('compressor.repo', () => {
  describe('createCompressor', () => {
    it('calls compressor.create with correct args and returns parsed compressor', async () => {
      const create = vi.fn(async () => makeRow())
      const tx = { compressor: { create } }

      const result = await createCompressor(tx, {
        tenantId: 'tenant-a',
        rackId: 'rack-1',
        compressorNumber: '1',
      })

      expect(create).toHaveBeenCalledWith({
        data: { tenantId: 'tenant-a', rackId: 'rack-1', compressorNumber: '1', compressorRefId: null, data: '{}' },
      })
      expect(result.id).toBe('comp-1')
      expect(result.compressorRefId).toBeNull()
      expect(result.data).toEqual({})
    })

    it('persists compressorRefId + data blob when provided', async () => {
      const create = vi.fn<(arg: AnyArg) => Promise<unknown>>(
        async () => makeRow({ compressorRefId: 'ref-1', data: JSON.stringify({ general: { modelNumber: 'ZB45' } }) }),
      )
      const tx = { compressor: { create } }

      const result = await createCompressor(tx, {
        tenantId: 'tenant-a',
        rackId: 'rack-1',
        compressorNumber: '2',
        compressorRefId: 'ref-1',
        data: { general: { modelNumber: 'ZB45' } },
      })

      expect((create.mock.calls[0]![0] as AnyArg)['data']).toMatchObject({
        compressorRefId: 'ref-1',
        data: JSON.stringify({ general: { modelNumber: 'ZB45' } }),
      })
      expect(result.compressorRefId).toBe('ref-1')
    })
  })

  describe('getCompressorsByRackId', () => {
    it('returns empty array when none exist', async () => {
      const findMany = vi.fn(async () => [])
      const tx = { compressor: { findMany } }
      const result = await getCompressorsByRackId(tx, { rackId: 'rack-1' })
      expect(result).toEqual([])
    })

    it('returns mapped array, querying by rackId asc', async () => {
      const rows = [makeRow(), makeRow({ id: 'comp-2', compressorNumber: '2', data: JSON.stringify({ x: 1 }) })]
      const findMany = vi.fn<(arg: AnyArg) => Promise<unknown[]>>(async () => rows)
      const tx = { compressor: { findMany } }

      const result = await getCompressorsByRackId(tx, { rackId: 'rack-1' })

      expect(result).toHaveLength(2)
      expect(result[1]!.data).toEqual({ x: 1 })
      expect(findMany.mock.calls[0]![0]).toEqual({
        where: { rackId: 'rack-1' },
        orderBy: { createdAt: 'asc' },
      })
    })
  })

  describe('getCompressorById', () => {
    it('returns null when not found', async () => {
      const findUnique = vi.fn(async () => null)
      const tx = { compressor: { findUnique } }
      expect(await getCompressorById(tx, { id: 'gone' })).toBeNull()
    })

    it('returns mapped compressor when found', async () => {
      const findUnique = vi.fn(async () => makeRow({ compressorRefId: 'ref-9' }))
      const tx = { compressor: { findUnique } }
      const result = await getCompressorById(tx, { id: 'comp-1' })
      expect(result!.compressorRefId).toBe('ref-9')
    })
  })

  describe('upsertCompressorData', () => {
    it('updates data with rackId in WHERE (cross-rack guard) without touching compressorRefId when absent', async () => {
      const update = vi.fn<(arg: AnyArg) => Promise<unknown>>(async () => ({ updatedAt: now }))
      const tx = { compressor: { update } }

      const result = await upsertCompressorData(tx, {
        id: 'comp-1',
        rackId: 'rack-1',
        tenantId: 'tenant-a',
        data: { general: { modelNumber: 'ZB45' } },
      })

      expect(result).toEqual({ savedAt: now.toISOString(), compressorId: 'comp-1' })
      expect((update.mock.calls[0]![0] as AnyArg)['where']).toEqual({ id: 'comp-1', rackId: 'rack-1' })
      expect((update.mock.calls[0]![0] as AnyArg)['data']).toEqual({
        data: JSON.stringify({ general: { modelNumber: 'ZB45' } }),
      })
    })

    it('writes compressorRefId when the key is present (incl. null)', async () => {
      const update = vi.fn<(arg: AnyArg) => Promise<unknown>>(async () => ({ updatedAt: now }))
      const tx = { compressor: { update } }

      await upsertCompressorData(tx, {
        id: 'comp-1',
        rackId: 'rack-1',
        tenantId: 'tenant-a',
        data: {},
        compressorRefId: 'ref-1',
      })
      expect((update.mock.calls[0]![0] as AnyArg)['data']).toEqual({ data: '{}', compressorRefId: 'ref-1' })

      await upsertCompressorData(tx, {
        id: 'comp-1',
        rackId: 'rack-1',
        tenantId: 'tenant-a',
        data: {},
        compressorRefId: null,
      })
      expect((update.mock.calls[1]![0] as AnyArg)['data']).toEqual({ data: '{}', compressorRefId: null })
    })

    it('throws CompressorNotFoundError on P2025', async () => {
      const p2025 = Object.assign(new Error('Record not found'), { code: 'P2025' })
      const update = vi.fn(async () => { throw p2025 })
      const tx = { compressor: { update } }

      await expect(
        upsertCompressorData(tx, { id: 'missing', rackId: 'rack-1', tenantId: 'tenant-a', data: {} }),
      ).rejects.toBeInstanceOf(CompressorNotFoundError)
    })
  })

  describe('duplicateCompressor', () => {
    it('copies data + compressorRefId but clears data.general.serialNumber', async () => {
      const source = makeRow({
        id: 'comp-1',
        compressorRefId: 'ref-1',
        data: JSON.stringify({
          general: { modelNumber: 'ZB45', serialNumber: 'SN-123', eer: '11.2', refrigerantType: 'R-404A' },
        }),
      })
      const findUnique = vi.fn(async () => source)
      const create = vi.fn<(arg: AnyArg) => Promise<unknown>>(
        async () => makeRow({ id: 'comp-2', compressorNumber: '2', compressorRefId: 'ref-1' }),
      )
      const tx = { compressor: { findUnique, create } }

      const result = await duplicateCompressor(tx, {
        sourceId: 'comp-1',
        rackId: 'rack-1',
        tenantId: 'tenant-a',
        compressorNumber: '2',
      })

      const createArg = create.mock.calls[0]![0] as { data: { data: string; compressorRefId: string | null } }
      const createdData = JSON.parse(createArg.data.data) as { general: Record<string, unknown> }
      expect(createdData.general).toEqual({ modelNumber: 'ZB45', eer: '11.2', refrigerantType: 'R-404A' })
      expect(createdData.general['serialNumber']).toBeUndefined()
      expect(createArg.data.compressorRefId).toBe('ref-1')
      expect(result.id).toBe('comp-2')
    })

    it('throws CompressorNotFoundError when source belongs to a different rack', async () => {
      const source = makeRow({ rackId: 'rack-other' })
      const findUnique = vi.fn(async () => source)
      const create = vi.fn()
      const tx = { compressor: { findUnique, create } }

      await expect(
        duplicateCompressor(tx, { sourceId: 'comp-1', rackId: 'rack-1', tenantId: 'tenant-a', compressorNumber: '2' }),
      ).rejects.toBeInstanceOf(CompressorNotFoundError)
      expect(create).not.toHaveBeenCalled()
    })

    it('throws CompressorNotFoundError when source missing', async () => {
      const findUnique = vi.fn(async () => null)
      const tx = { compressor: { findUnique, create: vi.fn() } }

      await expect(
        duplicateCompressor(tx, { sourceId: 'gone', rackId: 'rack-1', tenantId: 'tenant-a', compressorNumber: '2' }),
      ).rejects.toBeInstanceOf(CompressorNotFoundError)
    })
  })
})
