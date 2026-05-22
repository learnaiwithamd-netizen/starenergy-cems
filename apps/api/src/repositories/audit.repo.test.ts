import { describe, it, expect, vi } from 'vitest'
import { AuditStatus } from '@cems/types'
import {
  listAuditsForCaller,
  createAudit,
  getLatestCompressorDbVersion,
  upsertAuditSection,
  getAuditById,
  findActiveDraftForAuditor,
} from './audit.repo.js'
import { AuditNotEditableError } from '../lib/audit-errors.js'

type AnyArg = Record<string, unknown>

describe('audit.repo', () => {
  describe('listAuditsForCaller', () => {
    it('returns mapped rows with ISO timestamps and joined storeNumber (P13)', async () => {
      const findMany = vi.fn<(arg: AnyArg) => Promise<unknown[]>>(async () => [
        {
          id: 'a-1',
          storeId: 'store-001',
          status: 'DRAFT',
          createdAt: new Date('2026-05-01T00:00:00Z'),
          updatedAt: new Date('2026-05-02T00:00:00Z'),
          store: { storeNumber: 'STORE-001' },
        },
        {
          id: 'a-2',
          storeId: 'store-002',
          status: 'PUBLISHED',
          createdAt: new Date('2026-05-03T00:00:00Z'),
          updatedAt: new Date('2026-05-03T00:00:00Z'),
          store: { storeNumber: 'STORE-002' },
        },
      ])
      const tx = { audit: { findMany } }

      const res = await listAuditsForCaller(tx)

      expect(res.audits).toHaveLength(2)
      expect(res.total).toBe(2)
      expect(res.audits[0]).toEqual({
        id: 'a-1',
        storeId: 'store-001',
        storeNumber: 'STORE-001',
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
        store: { select: { storeNumber: true } },
      })
      expect(arg['orderBy']).toEqual({ updatedAt: 'desc' })
      expect(arg['take']).toBe(50)
      expect(arg['where']).toEqual({})
    })

    it('falls back to null storeNumber when store relation is missing', async () => {
      const findMany = vi.fn<(arg: AnyArg) => Promise<unknown[]>>(async () => [
        {
          id: 'a-1',
          storeId: 'store-001',
          status: 'DRAFT',
          createdAt: new Date('2026-05-01T00:00:00Z'),
          updatedAt: new Date('2026-05-02T00:00:00Z'),
          store: null,
        },
      ])
      const tx = { audit: { findMany } }
      const res = await listAuditsForCaller(tx)
      expect(res.audits[0]!.storeNumber).toBeNull()
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

    it('forwards status filter into where clause (Story 2.3)', async () => {
      const findMany = vi.fn<(arg: AnyArg) => Promise<unknown[]>>(async () => [])
      const tx = { audit: { findMany } }
      await listAuditsForCaller(tx, { status: AuditStatus.DRAFT })
      expect(findMany.mock.calls[0]![0]['where']).toEqual({ status: AuditStatus.DRAFT })
    })

    it('forwards auditorUserId filter into where clause (Story 2.3)', async () => {
      const findMany = vi.fn<(arg: AnyArg) => Promise<unknown[]>>(async () => [])
      const tx = { audit: { findMany } }
      await listAuditsForCaller(tx, { auditorUserId: 'user-1' })
      expect(findMany.mock.calls[0]![0]['where']).toEqual({ auditorUserId: 'user-1' })
    })

    it('combines status + auditorUserId filters (Story 2.3 resume query)', async () => {
      const findMany = vi.fn<(arg: AnyArg) => Promise<unknown[]>>(async () => [])
      const tx = { audit: { findMany } }
      await listAuditsForCaller(tx, { status: AuditStatus.DRAFT, auditorUserId: 'user-1' })
      expect(findMany.mock.calls[0]![0]['where']).toEqual({
        status: AuditStatus.DRAFT,
        auditorUserId: 'user-1',
      })
    })
  })

  describe('createAudit', () => {
    const input = {
      tenantId: 'tenant-a',
      clientId: 'tenant-a',
      storeId: 'store-1',
      auditorUserId: 'user-1',
      formVersion: '1.0',
      compressorDbVersion: '2.0',
    }

    it('creates audit with DRAFT status and returns auditId', async () => {
      const create = vi.fn(async () => ({ id: 'audit-new-1' }))
      const tx = { audit: { create } }
      const result = await createAudit(tx, input)
      expect(result).toEqual({ auditId: 'audit-new-1' })
    })

    it('passes correct fields including status=DRAFT and currentSectionId=general', async () => {
      const create = vi.fn<(arg: AnyArg) => Promise<{ id: string }>>(async () => ({ id: 'audit-new-2' }))
      const tx = { audit: { create } }
      await createAudit(tx, input)
      const data = create.mock.calls[0]![0]['data'] as Record<string, unknown>
      expect(data['status']).toBe(AuditStatus.DRAFT)
      expect(data['currentSectionId']).toBe('general')
      expect(data['tenantId']).toBe('tenant-a')
      expect(data['storeId']).toBe('store-1')
      expect(data['auditorUserId']).toBe('user-1')
      expect(data['formVersion']).toBe('1.0')
      expect(data['compressorDbVersion']).toBe('2.0')
    })
  })

  describe('getLatestCompressorDbVersion', () => {
    it('returns the latest version from the table', async () => {
      const findFirst = vi.fn<(arg: AnyArg) => Promise<{ compressorDbVersion: string } | null>>(
        async () => ({ compressorDbVersion: '3.1' }),
      )
      const tx = { compressorRef: { findFirst } }
      const result = await getLatestCompressorDbVersion(tx)
      expect(result).toBe('3.1')
      expect(findFirst.mock.calls[0]![0]).toMatchObject({ orderBy: { createdAt: 'desc' } })
    })

    it('falls back to "1.0" when table is empty', async () => {
      const findFirst = vi.fn(async () => null)
      const tx = { compressorRef: { findFirst } }
      const result = await getLatestCompressorDbVersion(tx)
      expect(result).toBe('1.0')
    })
  })

  describe('findActiveDraftForAuditor', () => {
    it('returns the most-recent DRAFT for the auditor', async () => {
      const findFirst = vi.fn<(arg: AnyArg) => Promise<{ id: string; storeId: string } | null>>(
        async () => ({ id: 'audit-1', storeId: 'store-1' }),
      )
      const tx = { audit: { findFirst } }
      const res = await findActiveDraftForAuditor(tx, 'user-1')
      expect(res).toEqual({ id: 'audit-1', storeId: 'store-1' })
      expect(findFirst.mock.calls[0]![0]).toEqual({
        where: { auditorUserId: 'user-1', status: AuditStatus.DRAFT },
        select: { id: true, storeId: true },
        orderBy: { updatedAt: 'desc' },
      })
    })

    it('returns null when no draft exists', async () => {
      const tx = { audit: { findFirst: vi.fn(async () => null) } }
      const res = await findActiveDraftForAuditor(tx, 'user-1')
      expect(res).toBeNull()
    })
  })

  describe('upsertAuditSection', () => {
    it('updates audit.currentSectionId then upserts the section row', async () => {
      const update = vi.fn<(arg: AnyArg) => Promise<{ updatedAt: Date }>>(
        async () => ({ updatedAt: new Date('2026-05-09T10:00:00Z') }),
      )
      const upsert = vi.fn<(arg: AnyArg) => Promise<Record<string, unknown>>>(async () => ({}))
      const tx = { audit: { update }, auditSection: { upsert } }
      const res = await upsertAuditSection(tx, {
        tenantId: 'tenant-a',
        auditId: 'audit-1',
        auditorUserId: 'user-1',
        sectionId: 'general',
        data: { auditDate: '2026-05-09' },
      })
      expect(res).toEqual({ savedAt: '2026-05-09T10:00:00.000Z' })
      // Atomic where-clause (P2 fix): id + auditorUserId + status='DRAFT'.
      expect(update.mock.calls[0]![0]).toEqual({
        where: { id: 'audit-1', auditorUserId: 'user-1', status: AuditStatus.DRAFT },
        data: { currentSectionId: 'general' },
        select: { updatedAt: true },
      })
      const upsertArg = upsert.mock.calls[0]![0] as Record<string, unknown>
      expect(upsertArg['where']).toEqual({
        auditId_sectionId: { auditId: 'audit-1', sectionId: 'general' },
      })
      const create = upsertArg['create'] as Record<string, unknown>
      expect(create['tenantId']).toBe('tenant-a')
      expect(create['auditId']).toBe('audit-1')
      expect(create['sectionId']).toBe('general')
      expect(create['data']).toBe(JSON.stringify({ auditDate: '2026-05-09' }))
      const updateClause = upsertArg['update'] as Record<string, unknown>
      expect(updateClause['data']).toBe(JSON.stringify({ auditDate: '2026-05-09' }))
      expect(updateClause).not.toHaveProperty('tenantId')
    })

    it('throws AuditNotEditableError when audit row is missing (P2025)', async () => {
      const p2025 = Object.assign(new Error('Record not found'), { code: 'P2025' })
      const update = vi.fn(async () => { throw p2025 })
      const tx = { audit: { update }, auditSection: { upsert: vi.fn() } }
      await expect(
        upsertAuditSection(tx, {
          tenantId: 'tenant-a',
          auditId: 'missing-audit',
          auditorUserId: 'user-1',
          sectionId: 'general',
          data: {},
        }),
      ).rejects.toBeInstanceOf(AuditNotEditableError)
    })

    it('serialises empty data correctly', async () => {
      const update = vi.fn<(arg: AnyArg) => Promise<{ updatedAt: Date }>>(
        async () => ({ updatedAt: new Date('2026-05-09T11:00:00Z') }),
      )
      const upsert = vi.fn<(arg: AnyArg) => Promise<Record<string, unknown>>>(async () => ({}))
      const tx = { audit: { update }, auditSection: { upsert } }
      await upsertAuditSection(tx, {
        tenantId: 'tenant-a',
        auditId: 'audit-1',
        auditorUserId: 'user-1',
        sectionId: 'hvac',
        data: {},
      })
      const upsertArg = upsert.mock.calls[0]![0] as Record<string, unknown>
      const create = upsertArg['create'] as Record<string, unknown>
      expect(create['data']).toBe('{}')
    })
  })

  describe('getAuditById', () => {
    it('returns null when audit not visible', async () => {
      const findUnique = vi.fn(async () => null)
      const tx = { audit: { findUnique } }
      const res = await getAuditById(tx, 'audit-x')
      expect(res).toBeNull()
    })

    it('parses sections[].data from JSON string and maps timestamps to ISO', async () => {
      const findUnique = vi.fn(async () => ({
        id: 'audit-1',
        storeId: 'store-001',
        auditorUserId: 'user-1',
        status: 'DRAFT',
        currentSectionId: 'general',
        formVersion: '1.0',
        compressorDbVersion: '2.0',
        createdAt: new Date('2026-05-08T10:00:00Z'),
        updatedAt: new Date('2026-05-09T10:00:00Z'),
        sections: [
          {
            sectionId: 'general',
            data: JSON.stringify({ auditDate: '2026-05-09', notes: 'hi' }),
            completedAt: null,
            updatedAt: new Date('2026-05-09T10:00:00Z'),
          },
        ],
      }))
      const tx = { audit: { findUnique } }
      const res = await getAuditById(tx, 'audit-1')
      expect(res).not.toBeNull()
      expect(res!.id).toBe('audit-1')
      expect(res!.auditorUserId).toBe('user-1')
      expect(res!.status).toBe(AuditStatus.DRAFT)
      expect(res!.currentSectionId).toBe('general')
      expect(res!.sections).toHaveLength(1)
      expect(res!.sections[0]!).toEqual({
        sectionId: 'general',
        data: { auditDate: '2026-05-09', notes: 'hi' },
        completedAt: null,
        updatedAt: '2026-05-09T10:00:00.000Z',
      })
    })

    it('falls back to {} when sections[].data is malformed JSON', async () => {
      const findUnique = vi.fn(async () => ({
        id: 'audit-2',
        storeId: 'store-001',
        auditorUserId: 'user-1',
        status: 'DRAFT',
        currentSectionId: null,
        formVersion: '1.0',
        compressorDbVersion: '1.0',
        createdAt: new Date('2026-05-08T10:00:00Z'),
        updatedAt: new Date('2026-05-09T10:00:00Z'),
        sections: [
          {
            sectionId: 'general',
            data: 'not-json',
            completedAt: null,
            updatedAt: new Date('2026-05-09T10:00:00Z'),
          },
        ],
      }))
      const tx = { audit: { findUnique } }
      const res = await getAuditById(tx, 'audit-2')
      expect(res!.sections[0]!.data).toEqual({})
    })

    it('maps completedAt to ISO when set', async () => {
      const findUnique = vi.fn(async () => ({
        id: 'audit-3',
        storeId: 'store-001',
        auditorUserId: 'user-1',
        status: 'DRAFT',
        currentSectionId: null,
        formVersion: '1.0',
        compressorDbVersion: '1.0',
        createdAt: new Date('2026-05-08T10:00:00Z'),
        updatedAt: new Date('2026-05-09T10:00:00Z'),
        sections: [
          {
            sectionId: 'general',
            data: '{}',
            completedAt: new Date('2026-05-09T11:30:00Z'),
            updatedAt: new Date('2026-05-09T11:30:00Z'),
          },
        ],
      }))
      const tx = { audit: { findUnique } }
      const res = await getAuditById(tx, 'audit-3')
      expect(res!.sections[0]!.completedAt).toBe('2026-05-09T11:30:00.000Z')
    })

    it('normalises unknown currentSectionId to null (P6)', async () => {
      const findUnique = vi.fn(async () => ({
        id: 'audit-4',
        storeId: 'store-001',
        auditorUserId: 'user-1',
        status: 'DRAFT',
        currentSectionId: 'some-future-section',
        formVersion: '1.0',
        compressorDbVersion: '1.0',
        createdAt: new Date('2026-05-08T10:00:00Z'),
        updatedAt: new Date('2026-05-09T10:00:00Z'),
        sections: [],
      }))
      const tx = { audit: { findUnique } }
      const res = await getAuditById(tx, 'audit-4')
      expect(res!.currentSectionId).toBeNull()
    })
  })
})
