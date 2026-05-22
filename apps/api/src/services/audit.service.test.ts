import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuditStatus, UserRole } from '@cems/types'

const { fakeTx, repoMock } = vi.hoisted(() => ({
  fakeTx: {
    storeRef: { findUnique: vi.fn() },
  },
  repoMock: {
    createAudit: vi.fn(),
    getLatestCompressorDbVersion: vi.fn(),
    findActiveDraftForAuditor: vi.fn(),
    upsertAuditSection: vi.fn(),
    getAuditById: vi.fn(),
    listAuditsForCaller: vi.fn(),
  },
}))
vi.mock('../repositories/audit.repo.js', () => repoMock)

import {
  createAuditDraft,
  getAuditDetail,
  listAudits,
  patchAuditSection,
} from './audit.service.js'
import {
  AuditNotEditableError,
  AuditNotFoundError,
  DraftAlreadyExistsError,
  StoreNotAssignedError,
  StoreNotFoundError,
} from '../lib/audit-errors.js'

interface FakeRequest {
  rlsContext: {
    tenantId: string
    userId: string
    role: UserRole
    assignedStoreIds: readonly string[]
  } | null
  withRls: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T>
}

function fakeRequest(
  role: UserRole,
  userId = 'user-1',
  assignedStoreIds: readonly string[] = ['store-1'],
): FakeRequest {
  return {
    rlsContext: { tenantId: 'tenant-a', userId, role, assignedStoreIds },
    withRls: <T>(fn: (tx: unknown) => Promise<T>) => fn(fakeTx),
  }
}

const sampleDetail = {
  id: 'audit-1',
  storeId: 'store-001',
  auditorUserId: 'user-1',
  status: AuditStatus.DRAFT,
  currentSectionId: 'general' as const,
  formVersion: '1.0',
  compressorDbVersion: '2.0',
  createdAt: '2026-05-08T10:00:00.000Z',
  updatedAt: '2026-05-09T10:00:00.000Z',
  sections: [],
}

describe('audit.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    repoMock.getLatestCompressorDbVersion.mockResolvedValue('2.0')
    repoMock.createAudit.mockResolvedValue({ auditId: 'new-audit-1' })
    repoMock.findActiveDraftForAuditor.mockResolvedValue(null)
    fakeTx.storeRef.findUnique.mockResolvedValue({ id: 'store-1' })
  })

  describe('createAuditDraft', () => {
    it('creates a DRAFT audit and returns auditId for AUDITOR on assigned store', async () => {
      const req = fakeRequest(UserRole.AUDITOR)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await createAuditDraft({ storeId: 'store-1' }, { request: req as any })
      expect(result).toEqual({ auditId: 'new-audit-1' })
    })

    it('passes correct fields to repo.createAudit', async () => {
      const req = fakeRequest(UserRole.AUDITOR)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await createAuditDraft({ storeId: 'store-1' }, { request: req as any })
      expect(repoMock.createAudit).toHaveBeenCalledWith(fakeTx, {
        tenantId: 'tenant-a',
        clientId: 'tenant-a',
        storeId: 'store-1',
        auditorUserId: 'user-1',
        formVersion: '1.0',
        compressorDbVersion: '2.0',
      })
    })

    it('uses latest compressorDbVersion from DB', async () => {
      repoMock.getLatestCompressorDbVersion.mockResolvedValue('3.5')
      const req = fakeRequest(UserRole.AUDITOR)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await createAuditDraft({ storeId: 'store-1' }, { request: req as any })
      const callArg = repoMock.createAudit.mock.calls[0]![1]
      expect(callArg.compressorDbVersion).toBe('3.5')
    })

    it('throws StoreNotAssignedError when AUDITOR is not assigned to the store (P15)', async () => {
      const req = fakeRequest(UserRole.AUDITOR, 'user-1', ['store-other'])
      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        createAuditDraft({ storeId: 'store-1' }, { request: req as any }),
      ).rejects.toBeInstanceOf(StoreNotAssignedError)
      expect(repoMock.createAudit).not.toHaveBeenCalled()
      // Must reject BEFORE hitting the DB so unassigned stores can't be enumerated.
      expect(fakeTx.storeRef.findUnique).not.toHaveBeenCalled()
    })

    it('throws DraftAlreadyExistsError when AUDITOR already has a DRAFT (P16)', async () => {
      repoMock.findActiveDraftForAuditor.mockResolvedValue({
        id: 'audit-existing',
        storeId: 'store-existing',
      })
      const req = fakeRequest(UserRole.AUDITOR)
      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        createAuditDraft({ storeId: 'store-1' }, { request: req as any }),
      ).rejects.toMatchObject({
        name: 'DraftAlreadyExistsError',
        existingAuditId: 'audit-existing',
        existingStoreId: 'store-existing',
      })
      expect(repoMock.createAudit).not.toHaveBeenCalled()
    })

    it('throws StoreNotFoundError when storeId not found in tenant', async () => {
      fakeTx.storeRef.findUnique.mockResolvedValue(null)
      const req = fakeRequest(UserRole.AUDITOR)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(createAuditDraft({ storeId: 'store-1' }, { request: req as any })).rejects.toBeInstanceOf(
        StoreNotFoundError,
      )
      expect(repoMock.createAudit).not.toHaveBeenCalled()
    })

    it('throws RoleNotPermittedError for ADMIN caller', async () => {
      const req = fakeRequest(UserRole.ADMIN)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(createAuditDraft({ storeId: 'store-1' }, { request: req as any })).rejects.toThrow()
    })

    it('throws RoleNotPermittedError for CLIENT caller', async () => {
      const req = fakeRequest(UserRole.CLIENT)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(createAuditDraft({ storeId: 'store-1' }, { request: req as any })).rejects.toThrow()
    })
  })

  describe('patchAuditSection', () => {
    beforeEach(() => {
      repoMock.upsertAuditSection.mockResolvedValue({ savedAt: '2026-05-09T10:00:00.000Z' })
    })

    it('AUDITOR → upserts section with auditorUserId for atomic check (P2)', async () => {
      const req = fakeRequest(UserRole.AUDITOR)
      const res = await patchAuditSection(
        { id: 'audit-1', sectionId: 'general' },
        { data: { auditDate: '2026-05-09' } },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { request: req as any },
      )
      expect(res).toEqual({ sectionId: 'general', savedAt: '2026-05-09T10:00:00.000Z' })
      expect(repoMock.upsertAuditSection).toHaveBeenCalledWith(fakeTx, {
        tenantId: 'tenant-a',
        auditId: 'audit-1',
        auditorUserId: 'user-1',
        sectionId: 'general',
        data: { auditDate: '2026-05-09' },
      })
    })

    it('throws RoleNotPermittedError for ADMIN caller', async () => {
      const req = fakeRequest(UserRole.ADMIN)
      await expect(
        patchAuditSection(
          { id: 'audit-1', sectionId: 'general' },
          { data: {} },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          { request: req as any },
        ),
      ).rejects.toThrow('Role not permitted')
      expect(repoMock.upsertAuditSection).not.toHaveBeenCalled()
    })

    it('throws RoleNotPermittedError for CLIENT caller', async () => {
      const req = fakeRequest(UserRole.CLIENT)
      await expect(
        patchAuditSection(
          { id: 'audit-1', sectionId: 'general' },
          { data: {} },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          { request: req as any },
        ),
      ).rejects.toThrow('Role not permitted')
    })

    it('surfaces repo AuditNotEditableError (atomic where-clause miss) directly', async () => {
      repoMock.upsertAuditSection.mockRejectedValue(new AuditNotEditableError())
      const req = fakeRequest(UserRole.AUDITOR)
      await expect(
        patchAuditSection(
          { id: 'audit-x', sectionId: 'general' },
          { data: {} },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          { request: req as any },
        ),
      ).rejects.toBeInstanceOf(AuditNotEditableError)
    })
  })

  describe('getAuditDetail', () => {
    it('AUDITOR sees own audit', async () => {
      repoMock.getAuditById.mockResolvedValue(sampleDetail)
      const req = fakeRequest(UserRole.AUDITOR, 'user-1')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await getAuditDetail('audit-1', { request: req as any })
      expect(res).toEqual(sampleDetail)
      expect(repoMock.getAuditById).toHaveBeenCalledWith(fakeTx, 'audit-1')
    })

    it('AUDITOR viewing peer audit → AuditNotFoundError (P14)', async () => {
      repoMock.getAuditById.mockResolvedValue({ ...sampleDetail, auditorUserId: 'other-user' })
      const req = fakeRequest(UserRole.AUDITOR, 'user-1')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(getAuditDetail('audit-1', { request: req as any })).rejects.toBeInstanceOf(
        AuditNotFoundError,
      )
    })

    it('ADMIN sees any audit in tenant', async () => {
      repoMock.getAuditById.mockResolvedValue({ ...sampleDetail, auditorUserId: 'other-user' })
      const req = fakeRequest(UserRole.ADMIN, 'admin-1')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await getAuditDetail('audit-1', { request: req as any })
      expect(res.id).toBe('audit-1')
    })

    it('CLIENT sees any audit visible via RLS (store-scoped)', async () => {
      repoMock.getAuditById.mockResolvedValue({ ...sampleDetail, auditorUserId: 'other-user' })
      const req = fakeRequest(UserRole.CLIENT, 'client-1')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await getAuditDetail('audit-1', { request: req as any })
      expect(res.id).toBe('audit-1')
    })

    it('throws AuditNotFoundError when repo returns null', async () => {
      repoMock.getAuditById.mockResolvedValue(null)
      const req = fakeRequest(UserRole.AUDITOR)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(getAuditDetail('audit-x', { request: req as any })).rejects.toBeInstanceOf(
        AuditNotFoundError,
      )
    })
  })

  describe('listAudits', () => {
    beforeEach(() => {
      repoMock.listAuditsForCaller.mockResolvedValue({ audits: [], total: 0 })
    })

    it('AUDITOR caller: forces auditorUserId = caller (ignores explicit param)', async () => {
      const req = fakeRequest(UserRole.AUDITOR, 'user-1')
      await listAudits(
        { status: AuditStatus.DRAFT, auditorId: 'someone-else' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { request: req as any },
      )
      expect(repoMock.listAuditsForCaller).toHaveBeenCalledWith(fakeTx, {
        status: AuditStatus.DRAFT,
        auditorUserId: 'user-1',
      })
    })

    it('AUDITOR caller without auditorId still scopes to caller', async () => {
      const req = fakeRequest(UserRole.AUDITOR, 'user-2')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await listAudits({}, { request: req as any })
      expect(repoMock.listAuditsForCaller).toHaveBeenCalledWith(fakeTx, { auditorUserId: 'user-2' })
    })

    it('ADMIN caller: passes through auditorId verbatim', async () => {
      const req = fakeRequest(UserRole.ADMIN, 'admin-1')
      await listAudits(
        { auditorId: 'auditor-target' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { request: req as any },
      )
      expect(repoMock.listAuditsForCaller).toHaveBeenCalledWith(fakeTx, {
        auditorUserId: 'auditor-target',
      })
    })

    it('ADMIN caller: resolves auditorId="me" to rls.userId', async () => {
      const req = fakeRequest(UserRole.ADMIN, 'admin-1')
      await listAudits(
        { auditorId: 'me' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { request: req as any },
      )
      expect(repoMock.listAuditsForCaller).toHaveBeenCalledWith(fakeTx, {
        auditorUserId: 'admin-1',
      })
    })

    it('ADMIN caller: omitting auditorId omits the filter', async () => {
      const req = fakeRequest(UserRole.ADMIN)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await listAudits({ status: AuditStatus.DRAFT }, { request: req as any })
      expect(repoMock.listAuditsForCaller).toHaveBeenCalledWith(fakeTx, {
        status: AuditStatus.DRAFT,
      })
    })

    it('CLIENT caller: ignores auditorId (RLS scopes by store)', async () => {
      const req = fakeRequest(UserRole.CLIENT)
      await listAudits(
        { auditorId: 'some-auditor' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { request: req as any },
      )
      const arg = repoMock.listAuditsForCaller.mock.calls[0]![1] as Record<string, unknown>
      expect(arg).not.toHaveProperty('auditorUserId')
    })
  })
})
