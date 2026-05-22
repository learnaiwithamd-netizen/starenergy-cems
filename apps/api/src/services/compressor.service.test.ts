import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuditStatus, UserRole } from '@cems/types'

const { fakeTx, auditRepoMock, compressorRepoMock, compressorRefRepoMock, userRepoMock, queueMock } = vi.hoisted(
  () => ({
    fakeTx: {},
    auditRepoMock: { getAuditOwnership: vi.fn() },
    compressorRepoMock: {
      createCompressor: vi.fn(),
      duplicateCompressor: vi.fn(),
      getCompressorById: vi.fn(),
      getCompressorsByRackId: vi.fn(),
      upsertCompressorData: vi.fn(),
    },
    compressorRefRepoMock: { findCompressorRefByModel: vi.fn() },
    userRepoMock: { listUsersByRole: vi.fn() },
    queueMock: { add: vi.fn() },
  }),
)

vi.mock('@cems/db', () => ({ prisma: {} }))
vi.mock('../repositories/audit.repo.js', () => auditRepoMock)
vi.mock('../repositories/compressor.repo.js', () => compressorRepoMock)
vi.mock('../repositories/compressor-ref.repo.js', () => compressorRefRepoMock)
vi.mock('../repositories/user.repo.js', () => userRepoMock)
vi.mock('../jobs/queue.js', () => ({ getEmailNotificationQueue: () => queueMock }))

import {
  createCompressor,
  getCompressors,
  getCompressorById,
  patchCompressor,
  duplicateCompressor,
  lookupCompressorRef,
  reportUnknownModel,
} from './compressor.service.js'
import { AuditNotEditableError, CompressorModelNotFoundError, CompressorNotFoundError } from '../lib/audit-errors.js'

interface FakeRequest {
  rlsContext: { tenantId: string; userId: string; role: UserRole; assignedStoreIds: readonly string[] } | null
  withRls: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T>
  log: { error: ReturnType<typeof vi.fn> }
}

function fakeRequest(role: UserRole, userId = 'user-1'): FakeRequest {
  return {
    rlsContext: { tenantId: 'tenant-a', userId, role, assignedStoreIds: [] },
    withRls: <T>(fn: (tx: unknown) => Promise<T>) => fn(fakeTx),
    log: { error: vi.fn() },
  }
}

const fakeDraftOwnership = { auditorUserId: 'user-1', status: AuditStatus.DRAFT }

const fakeCompressor = {
  id: 'comp-1',
  tenantId: 'tenant-a',
  rackId: 'rack-1',
  compressorNumber: '1',
  compressorRefId: null as string | null,
  data: {} as Record<string, unknown>,
  createdAt: '2026-05-22T10:00:00.000Z',
  updatedAt: '2026-05-22T10:00:00.000Z',
}

const ids = { compressorId: 'comp-1', rackId: 'rack-1', machineRoomId: 'mr-1', auditId: 'audit-1' }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asReq = (r: FakeRequest) => ({ request: r as any })

describe('compressor.service', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('createCompressor', () => {
    it('derives compressorNumber from existing count and returns created compressor', async () => {
      auditRepoMock.getAuditOwnership.mockResolvedValue(fakeDraftOwnership)
      compressorRepoMock.getCompressorsByRackId.mockResolvedValue([fakeCompressor])
      compressorRepoMock.createCompressor.mockResolvedValue({ ...fakeCompressor, id: 'comp-2', compressorNumber: '2' })

      const result = await createCompressor(
        { rackId: 'rack-1', machineRoomId: 'mr-1', auditId: 'audit-1' },
        asReq(fakeRequest(UserRole.AUDITOR)),
      )

      expect(compressorRepoMock.createCompressor).toHaveBeenCalledWith(fakeTx, {
        tenantId: 'tenant-a',
        rackId: 'rack-1',
        compressorNumber: '2',
      })
      expect(result.id).toBe('comp-2')
    })

    it('throws RoleNotPermittedError for ADMIN', async () => {
      await expect(
        createCompressor({ rackId: 'rack-1', machineRoomId: 'mr-1', auditId: 'audit-1' }, asReq(fakeRequest(UserRole.ADMIN))),
      ).rejects.toMatchObject({ name: 'RoleNotPermittedError' })
    })

    it('throws AuditNotEditableError when audit not DRAFT', async () => {
      auditRepoMock.getAuditOwnership.mockResolvedValue({ auditorUserId: 'user-1', status: AuditStatus.SUBMITTED })
      await expect(
        createCompressor({ rackId: 'rack-1', machineRoomId: 'mr-1', auditId: 'audit-1' }, asReq(fakeRequest(UserRole.AUDITOR))),
      ).rejects.toBeInstanceOf(AuditNotEditableError)
    })
  })

  describe('getCompressors', () => {
    it('returns the compressor list for any authenticated role', async () => {
      compressorRepoMock.getCompressorsByRackId.mockResolvedValue([fakeCompressor])
      const result = await getCompressors(
        { rackId: 'rack-1', machineRoomId: 'mr-1', auditId: 'audit-1' },
        asReq(fakeRequest(UserRole.CLIENT)),
      )
      expect(result).toEqual([fakeCompressor])
    })
  })

  describe('getCompressorById', () => {
    it('returns the compressor when found and rackId matches', async () => {
      compressorRepoMock.getCompressorById.mockResolvedValue(fakeCompressor)
      const result = await getCompressorById(ids, asReq(fakeRequest(UserRole.AUDITOR)))
      expect(result).toEqual(fakeCompressor)
    })

    it('throws CompressorNotFoundError when missing', async () => {
      compressorRepoMock.getCompressorById.mockResolvedValue(null)
      await expect(getCompressorById(ids, asReq(fakeRequest(UserRole.AUDITOR)))).rejects.toBeInstanceOf(
        CompressorNotFoundError,
      )
    })

    it('throws CompressorNotFoundError when rackId mismatches', async () => {
      compressorRepoMock.getCompressorById.mockResolvedValue({ ...fakeCompressor, rackId: 'rack-other' })
      await expect(getCompressorById(ids, asReq(fakeRequest(UserRole.AUDITOR)))).rejects.toBeInstanceOf(
        CompressorNotFoundError,
      )
    })
  })

  describe('patchCompressor', () => {
    it('forwards compressorRefId when the body carries the key', async () => {
      auditRepoMock.getAuditOwnership.mockResolvedValue(fakeDraftOwnership)
      compressorRepoMock.upsertCompressorData.mockResolvedValue({ savedAt: 'now', compressorId: 'comp-1' })

      await patchCompressor(
        { ...ids, body: { data: { general: { modelNumber: 'ZB45' } }, compressorRefId: 'ref-1' } },
        asReq(fakeRequest(UserRole.AUDITOR)),
      )

      expect(compressorRepoMock.upsertCompressorData).toHaveBeenCalledWith(fakeTx, {
        id: 'comp-1',
        rackId: 'rack-1',
        tenantId: 'tenant-a',
        data: { general: { modelNumber: 'ZB45' } },
        compressorRefId: 'ref-1',
      })
    })

    it('omits compressorRefId from the upsert when the body does not carry the key', async () => {
      auditRepoMock.getAuditOwnership.mockResolvedValue(fakeDraftOwnership)
      compressorRepoMock.upsertCompressorData.mockResolvedValue({ savedAt: 'now', compressorId: 'comp-1' })

      await patchCompressor({ ...ids, body: { data: {} } }, asReq(fakeRequest(UserRole.AUDITOR)))

      expect(compressorRepoMock.upsertCompressorData).toHaveBeenCalledWith(fakeTx, {
        id: 'comp-1',
        rackId: 'rack-1',
        tenantId: 'tenant-a',
        data: {},
      })
    })

    it('throws RoleNotPermittedError for non-AUDITOR', async () => {
      await expect(
        patchCompressor({ ...ids, body: { data: {} } }, asReq(fakeRequest(UserRole.ADMIN))),
      ).rejects.toMatchObject({ name: 'RoleNotPermittedError' })
    })
  })

  describe('duplicateCompressor', () => {
    it('duplicates with the next compressorNumber', async () => {
      auditRepoMock.getAuditOwnership.mockResolvedValue(fakeDraftOwnership)
      compressorRepoMock.getCompressorsByRackId.mockResolvedValue([fakeCompressor])
      compressorRepoMock.duplicateCompressor.mockResolvedValue({ ...fakeCompressor, id: 'comp-2', compressorNumber: '2' })

      const result = await duplicateCompressor(ids, asReq(fakeRequest(UserRole.AUDITOR)))

      expect(compressorRepoMock.duplicateCompressor).toHaveBeenCalledWith(fakeTx, {
        sourceId: 'comp-1',
        rackId: 'rack-1',
        tenantId: 'tenant-a',
        compressorNumber: '2',
      })
      expect(result.id).toBe('comp-2')
    })

    it('throws RoleNotPermittedError for CLIENT', async () => {
      await expect(duplicateCompressor(ids, asReq(fakeRequest(UserRole.CLIENT)))).rejects.toMatchObject({
        name: 'RoleNotPermittedError',
      })
    })
  })

  describe('lookupCompressorRef', () => {
    it('returns the ref when found', async () => {
      const ref = { id: 'ref-1', compressorDbVersion: '1.0', modelNumber: 'ZB45', manufacturer: 'Copeland', refrigerantType: 'R-404A', regressionCoefficients: {}, createdAt: 'now' }
      compressorRefRepoMock.findCompressorRefByModel.mockResolvedValue(ref)
      const result = await lookupCompressorRef({ model: 'ZB45' })
      expect(result).toEqual(ref)
    })

    it('throws CompressorModelNotFoundError when the model is unknown', async () => {
      compressorRefRepoMock.findCompressorRefByModel.mockResolvedValue(null)
      await expect(lookupCompressorRef({ model: 'NOPE' })).rejects.toBeInstanceOf(CompressorModelNotFoundError)
    })
  })

  describe('reportUnknownModel', () => {
    it('enqueues one job per ACTIVE admin, sets the flag, and returns reported:true', async () => {
      auditRepoMock.getAuditOwnership.mockResolvedValue(fakeDraftOwnership)
      compressorRepoMock.getCompressorById.mockResolvedValue({
        ...fakeCompressor,
        data: { general: { modelNumber: 'UNKNOWN-1' } },
      })
      userRepoMock.listUsersByRole.mockResolvedValue({
        users: [{ email: 'a@cems.local' }, { email: 'b@cems.local' }],
        total: 2,
      })
      compressorRepoMock.upsertCompressorData.mockResolvedValue({ savedAt: 'now', compressorId: 'comp-1' })

      const result = await reportUnknownModel(ids, asReq(fakeRequest(UserRole.AUDITOR)))

      expect(userRepoMock.listUsersByRole).toHaveBeenCalledWith(fakeTx, { role: UserRole.ADMIN, status: 'ACTIVE' })
      expect(queueMock.add).toHaveBeenCalledTimes(2)
      expect(queueMock.add).toHaveBeenCalledWith('compressor-model-unknown', {
        to: 'a@cems.local',
        templateId: 'compressor-model-unknown',
        variables: { modelNumber: 'UNKNOWN-1', auditId: 'audit-1', rackId: 'rack-1', compressorId: 'comp-1' },
        tenantId: 'tenant-a',
        auditId: 'audit-1',
      })
      const upsertArg = compressorRepoMock.upsertCompressorData.mock.calls[0]![1] as { data: Record<string, unknown> }
      expect(upsertArg.data['unknownModelReported']).toBe(true)
      expect(result).toEqual({ reported: true, adminsNotified: 2 })
    })

    it('is idempotent — second call short-circuits without enqueuing', async () => {
      auditRepoMock.getAuditOwnership.mockResolvedValue(fakeDraftOwnership)
      compressorRepoMock.getCompressorById.mockResolvedValue({
        ...fakeCompressor,
        data: { general: { modelNumber: 'UNKNOWN-1' }, unknownModelReported: true },
      })

      const result = await reportUnknownModel(ids, asReq(fakeRequest(UserRole.AUDITOR)))

      expect(result).toEqual({ reported: false, alreadyReported: true })
      expect(queueMock.add).not.toHaveBeenCalled()
      expect(compressorRepoMock.upsertCompressorData).not.toHaveBeenCalled()
    })

    it('returns adminsNotified:0 (and still sets the flag) when no admins exist', async () => {
      auditRepoMock.getAuditOwnership.mockResolvedValue(fakeDraftOwnership)
      compressorRepoMock.getCompressorById.mockResolvedValue({
        ...fakeCompressor,
        data: { general: { modelNumber: 'UNKNOWN-1' } },
      })
      userRepoMock.listUsersByRole.mockResolvedValue({ users: [], total: 0 })
      compressorRepoMock.upsertCompressorData.mockResolvedValue({ savedAt: 'now', compressorId: 'comp-1' })

      const result = await reportUnknownModel(ids, asReq(fakeRequest(UserRole.AUDITOR)))

      expect(queueMock.add).not.toHaveBeenCalled()
      expect(compressorRepoMock.upsertCompressorData).toHaveBeenCalled()
      expect(result).toEqual({ reported: true, adminsNotified: 0 })
    })

    it('throws CompressorNotFoundError when the compressor is missing', async () => {
      auditRepoMock.getAuditOwnership.mockResolvedValue(fakeDraftOwnership)
      compressorRepoMock.getCompressorById.mockResolvedValue(null)
      await expect(reportUnknownModel(ids, asReq(fakeRequest(UserRole.AUDITOR)))).rejects.toBeInstanceOf(
        CompressorNotFoundError,
      )
    })

    it('throws RoleNotPermittedError for ADMIN', async () => {
      await expect(reportUnknownModel(ids, asReq(fakeRequest(UserRole.ADMIN)))).rejects.toMatchObject({
        name: 'RoleNotPermittedError',
      })
    })
  })
})
