import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuditStatus, UserRole } from '@cems/types'

const { fakeTx, auditRepoMock, rackRepoMock } = vi.hoisted(() => ({
  fakeTx: {},
  auditRepoMock: {
    getAuditOwnership: vi.fn(),
  },
  rackRepoMock: {
    createRack: vi.fn(),
    duplicateRack: vi.fn(),
    getRackById: vi.fn(),
    getRacksByMachineRoomId: vi.fn(),
    upsertRackData: vi.fn(),
  },
}))

vi.mock('../repositories/audit.repo.js', () => auditRepoMock)
vi.mock('../repositories/rack.repo.js', () => rackRepoMock)

import { createRack, getRacks, getRackById, patchRack, duplicateRack } from './rack.service.js'
import { AuditNotEditableError, RackNotFoundError } from '../lib/audit-errors.js'

interface FakeRequest {
  rlsContext: {
    tenantId: string
    userId: string
    role: UserRole
    assignedStoreIds: readonly string[]
  } | null
  withRls: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T>
}

function fakeRequest(role: UserRole, userId = 'user-1'): FakeRequest {
  return {
    rlsContext: { tenantId: 'tenant-a', userId, role, assignedStoreIds: [] },
    withRls: <T>(fn: (tx: unknown) => Promise<T>) => fn(fakeTx),
  }
}

const fakeDraftOwnership = { auditorUserId: 'user-1', status: AuditStatus.DRAFT }

const fakeRack = {
  id: 'rack-1',
  tenantId: 'tenant-a',
  machineRoomId: 'mr-1',
  rackNumber: '1',
  data: {},
  createdAt: '2026-05-16T10:00:00.000Z',
  updatedAt: '2026-05-16T10:00:00.000Z',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asReq = (r: FakeRequest) => ({ request: r as any })

describe('rack.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createRack', () => {
    it('derives rackNumber from existing count and returns created rack', async () => {
      auditRepoMock.getAuditOwnership.mockResolvedValue(fakeDraftOwnership)
      rackRepoMock.getRacksByMachineRoomId.mockResolvedValue([fakeRack, { ...fakeRack, id: 'rack-2' }])
      rackRepoMock.createRack.mockResolvedValue({ ...fakeRack, id: 'rack-3', rackNumber: '3' })

      const result = await createRack({ machineRoomId: 'mr-1', auditId: 'audit-1' }, asReq(fakeRequest(UserRole.AUDITOR)))

      expect(rackRepoMock.createRack).toHaveBeenCalledWith(fakeTx, {
        tenantId: 'tenant-a',
        machineRoomId: 'mr-1',
        rackNumber: '3',
      })
      expect(result.id).toBe('rack-3')
    })

    it('throws RoleNotPermittedError for ADMIN', async () => {
      await expect(
        createRack({ machineRoomId: 'mr-1', auditId: 'audit-1' }, asReq(fakeRequest(UserRole.ADMIN))),
      ).rejects.toMatchObject({ name: 'RoleNotPermittedError' })
    })

    it('throws AuditNotEditableError when audit not DRAFT', async () => {
      auditRepoMock.getAuditOwnership.mockResolvedValue({ auditorUserId: 'user-1', status: AuditStatus.SUBMITTED })
      await expect(
        createRack({ machineRoomId: 'mr-1', auditId: 'audit-1' }, asReq(fakeRequest(UserRole.AUDITOR))),
      ).rejects.toBeInstanceOf(AuditNotEditableError)
    })

    it('retries once with re-derived rackNumber on P2002', async () => {
      auditRepoMock.getAuditOwnership.mockResolvedValue(fakeDraftOwnership)
      rackRepoMock.getRacksByMachineRoomId
        .mockResolvedValueOnce([fakeRack])
        .mockResolvedValueOnce([fakeRack, { ...fakeRack, id: 'rack-x' }])
      const p2002 = Object.assign(new Error('unique'), { code: 'P2002' })
      rackRepoMock.createRack
        .mockRejectedValueOnce(p2002)
        .mockResolvedValueOnce({ ...fakeRack, id: 'rack-3', rackNumber: '3' })

      const result = await createRack({ machineRoomId: 'mr-1', auditId: 'audit-1' }, asReq(fakeRequest(UserRole.AUDITOR)))

      expect(rackRepoMock.createRack).toHaveBeenCalledTimes(2)
      expect(rackRepoMock.createRack).toHaveBeenLastCalledWith(fakeTx, {
        tenantId: 'tenant-a',
        machineRoomId: 'mr-1',
        rackNumber: '3',
      })
      expect(result.id).toBe('rack-3')
    })
  })

  describe('getRacks', () => {
    it('returns rack list for any authenticated role', async () => {
      rackRepoMock.getRacksByMachineRoomId.mockResolvedValue([fakeRack])
      const result = await getRacks({ machineRoomId: 'mr-1', auditId: 'audit-1' }, asReq(fakeRequest(UserRole.CLIENT)))
      expect(result).toEqual([fakeRack])
    })
  })

  describe('getRackById', () => {
    it('returns the rack when found and machineRoomId matches', async () => {
      rackRepoMock.getRackById.mockResolvedValue(fakeRack)
      const result = await getRackById(
        { rackId: 'rack-1', machineRoomId: 'mr-1', auditId: 'audit-1' },
        asReq(fakeRequest(UserRole.AUDITOR)),
      )
      expect(result).toEqual(fakeRack)
    })

    it('throws RackNotFoundError when rack missing', async () => {
      rackRepoMock.getRackById.mockResolvedValue(null)
      await expect(
        getRackById({ rackId: 'gone', machineRoomId: 'mr-1', auditId: 'audit-1' }, asReq(fakeRequest(UserRole.AUDITOR))),
      ).rejects.toBeInstanceOf(RackNotFoundError)
    })

    it('throws RackNotFoundError when rack belongs to a different machine room', async () => {
      rackRepoMock.getRackById.mockResolvedValue({ ...fakeRack, machineRoomId: 'mr-other' })
      await expect(
        getRackById({ rackId: 'rack-1', machineRoomId: 'mr-1', auditId: 'audit-1' }, asReq(fakeRequest(UserRole.AUDITOR))),
      ).rejects.toBeInstanceOf(RackNotFoundError)
    })
  })

  describe('patchRack', () => {
    it('calls upsertRackData with correct args on happy path', async () => {
      auditRepoMock.getAuditOwnership.mockResolvedValue(fakeDraftOwnership)
      rackRepoMock.upsertRackData.mockResolvedValue({ savedAt: '2026-05-16T10:00:00.000Z', rackId: 'rack-1' })
      const payload = { general: { rackDesignation: 'A' } }

      const result = await patchRack(
        { rackId: 'rack-1', machineRoomId: 'mr-1', auditId: 'audit-1', data: payload },
        asReq(fakeRequest(UserRole.AUDITOR)),
      )

      expect(rackRepoMock.upsertRackData).toHaveBeenCalledWith(fakeTx, {
        id: 'rack-1',
        machineRoomId: 'mr-1',
        tenantId: 'tenant-a',
        data: payload,
      })
      expect(result).toEqual({ savedAt: '2026-05-16T10:00:00.000Z', rackId: 'rack-1' })
    })

    it('throws RoleNotPermittedError for non-AUDITOR', async () => {
      await expect(
        patchRack(
          { rackId: 'rack-1', machineRoomId: 'mr-1', auditId: 'audit-1', data: {} },
          asReq(fakeRequest(UserRole.ADMIN)),
        ),
      ).rejects.toMatchObject({ name: 'RoleNotPermittedError' })
    })

    it('throws AuditNotEditableError for wrong owner', async () => {
      auditRepoMock.getAuditOwnership.mockResolvedValue({ auditorUserId: 'other', status: AuditStatus.DRAFT })
      await expect(
        patchRack(
          { rackId: 'rack-1', machineRoomId: 'mr-1', auditId: 'audit-1', data: {} },
          asReq(fakeRequest(UserRole.AUDITOR)),
        ),
      ).rejects.toBeInstanceOf(AuditNotEditableError)
    })
  })

  describe('duplicateRack', () => {
    it('duplicates with next rackNumber on happy path', async () => {
      auditRepoMock.getAuditOwnership.mockResolvedValue(fakeDraftOwnership)
      rackRepoMock.getRacksByMachineRoomId.mockResolvedValue([fakeRack])
      rackRepoMock.duplicateRack.mockResolvedValue({ ...fakeRack, id: 'rack-2', rackNumber: '2' })

      const result = await duplicateRack(
        { rackId: 'rack-1', machineRoomId: 'mr-1', auditId: 'audit-1' },
        asReq(fakeRequest(UserRole.AUDITOR)),
      )

      expect(rackRepoMock.duplicateRack).toHaveBeenCalledWith(fakeTx, {
        sourceId: 'rack-1',
        machineRoomId: 'mr-1',
        tenantId: 'tenant-a',
        rackNumber: '2',
      })
      expect(result.id).toBe('rack-2')
    })

    it('throws RoleNotPermittedError for CLIENT', async () => {
      await expect(
        duplicateRack({ rackId: 'rack-1', machineRoomId: 'mr-1', auditId: 'audit-1' }, asReq(fakeRequest(UserRole.CLIENT))),
      ).rejects.toMatchObject({ name: 'RoleNotPermittedError' })
    })

    it('propagates RackNotFoundError from the repo', async () => {
      auditRepoMock.getAuditOwnership.mockResolvedValue(fakeDraftOwnership)
      rackRepoMock.getRacksByMachineRoomId.mockResolvedValue([])
      rackRepoMock.duplicateRack.mockRejectedValue(new RackNotFoundError())
      await expect(
        duplicateRack({ rackId: 'gone', machineRoomId: 'mr-1', auditId: 'audit-1' }, asReq(fakeRequest(UserRole.AUDITOR))),
      ).rejects.toBeInstanceOf(RackNotFoundError)
    })
  })
})
