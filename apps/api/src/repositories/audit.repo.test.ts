import { describe, it, expect, vi } from 'vitest'
import { AuditStatus } from '@cems/types'
import { listAuditsForCaller } from './audit.repo.js'

type AnyArg = Record<string, unknown>

describe('audit.repo', () => {
  describe('listAuditsForCaller', () => {
    it('returns mapped rows with ISO timestamps', async () => {
      const findMany = vi.fn<(arg: AnyArg) => Promise<unknown[]>>(async () => [
        {
          id: 'a-1',
          storeId: 'store-001',
          status: 'DRAFT',
          createdAt: new Date('2026-05-01T00:00:00Z'),
          updatedAt: new Date('2026-05-02T00:00:00Z'),
        },
        {
          id: 'a-2',
          storeId: 'store-002',
          status: 'PUBLISHED',
          createdAt: new Date('2026-05-03T00:00:00Z'),
          updatedAt: new Date('2026-05-03T00:00:00Z'),
        },
      ])
      const tx = { audit: { findMany } }

      const res = await listAuditsForCaller(tx)

      expect(res.audits).toHaveLength(2)
      expect(res.total).toBe(2)
      expect(res.audits[0]).toEqual({
        id: 'a-1',
        storeId: 'store-001',
        status: AuditStatus.DRAFT,
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-02T00:00:00.000Z',
      })
      // Verify the find arg shape — select clause excludes write/calc fields.
      const arg = findMany.mock.calls[0]![0]
      expect(arg['select']).toEqual({
        id: true,
        storeId: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      })
      expect(arg['orderBy']).toEqual({ createdAt: 'desc' })
      expect(arg['take']).toBe(50)
    })

    it('honours custom take parameter', async () => {
      const findMany = vi.fn<(arg: AnyArg) => Promise<unknown[]>>(async () => [])
      const tx = { audit: { findMany } }
      await listAuditsForCaller(tx, { take: 10 })
      expect(findMany.mock.calls[0]![0]['take']).toBe(10)
    })

    it('returns empty when no audits visible (RLS filter excluded everything)', async () => {
      const tx = { audit: { findMany: vi.fn(async () => []) } }
      const res = await listAuditsForCaller(tx)
      expect(res).toEqual({ audits: [], total: 0 })
    })
  })
})
