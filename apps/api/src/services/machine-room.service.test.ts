import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuditStatus, UserRole } from '@cems/types'

const { fakeTx, auditRepoMock, machineRoomRepoMock } = vi.hoisted(() => ({
  fakeTx: {},
  auditRepoMock: {
    getAuditOwnership: vi.fn(),
  },
  machineRoomRepoMock: {
    createMachineRoom: vi.fn(),
    getMachineRoomById: vi.fn(),
    getMachineRoomsByAuditId: vi.fn(),
    upsertMachineRoomData: vi.fn(),
  },
}))

vi.mock('../repositories/audit.repo.js', () => auditRepoMock)
vi.mock('../repositories/machine-room.repo.js', () => machineRoomRepoMock)

import {
  getOrCreateMachineRoom,
  getMachineRooms,
  patchMachineRoom,
} from './machine-room.service.js'
import { AuditNotEditableError } from '../lib/audit-errors.js'

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

const fakeMachineRoom = {
  id: 'mr-1',
  tenantId: 'tenant-a',
  auditId: 'audit-1',
  roomNumber: '1',
  data: {},
  createdAt: '2026-05-16T10:00:00.000Z',
  updatedAt: '2026-05-16T10:00:00.000Z',
}

describe('machine-room.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getOrCreateMachineRoom', () => {
    it('returns existing room when present (idempotent)', async () => {
      auditRepoMock.getAuditOwnership.mockResolvedValue(fakeDraftOwnership)
      machineRoomRepoMock.getMachineRoomsByAuditId.mockResolvedValue([fakeMachineRoom])

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await getOrCreateMachineRoom({ auditId: 'audit-1' }, { request: fakeRequest(UserRole.AUDITOR) as any })

      expect(result).toEqual(fakeMachineRoom)
      expect(machineRoomRepoMock.createMachineRoom).not.toHaveBeenCalled()
    })

    it('creates a new room when none exists', async () => {
      auditRepoMock.getAuditOwnership.mockResolvedValue(fakeDraftOwnership)
      machineRoomRepoMock.getMachineRoomsByAuditId.mockResolvedValue([])
      machineRoomRepoMock.createMachineRoom.mockResolvedValue(fakeMachineRoom)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await getOrCreateMachineRoom({ auditId: 'audit-1' }, { request: fakeRequest(UserRole.AUDITOR) as any })

      expect(machineRoomRepoMock.createMachineRoom).toHaveBeenCalledWith(fakeTx, {
        tenantId: 'tenant-a',
        auditId: 'audit-1',
        roomNumber: '1',
      })
      expect(result).toEqual(fakeMachineRoom)
    })

    it('throws RoleNotPermittedError for ADMIN', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(getOrCreateMachineRoom({ auditId: 'audit-1' }, { request: fakeRequest(UserRole.ADMIN) as any }))
        .rejects.toMatchObject({ name: 'RoleNotPermittedError' })
    })

    it('throws RoleNotPermittedError for CLIENT', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(getOrCreateMachineRoom({ auditId: 'audit-1' }, { request: fakeRequest(UserRole.CLIENT) as any }))
        .rejects.toMatchObject({ name: 'RoleNotPermittedError' })
    })

    it('throws AuditNotEditableError for non-owning auditor', async () => {
      auditRepoMock.getAuditOwnership.mockResolvedValue({ auditorUserId: 'other-user', status: AuditStatus.DRAFT })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(getOrCreateMachineRoom({ auditId: 'audit-1' }, { request: fakeRequest(UserRole.AUDITOR) as any }))
        .rejects.toBeInstanceOf(AuditNotEditableError)
    })

    it('throws AuditNotEditableError when audit is not DRAFT', async () => {
      auditRepoMock.getAuditOwnership.mockResolvedValue({ auditorUserId: 'user-1', status: AuditStatus.SUBMITTED })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(getOrCreateMachineRoom({ auditId: 'audit-1' }, { request: fakeRequest(UserRole.AUDITOR) as any }))
        .rejects.toBeInstanceOf(AuditNotEditableError)
    })

    it('throws AuditNotEditableError when audit not found', async () => {
      auditRepoMock.getAuditOwnership.mockResolvedValue(null)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(getOrCreateMachineRoom({ auditId: 'audit-1' }, { request: fakeRequest(UserRole.AUDITOR) as any }))
        .rejects.toBeInstanceOf(AuditNotEditableError)
    })
  })

  describe('getMachineRooms', () => {
    it('returns room list for any authenticated role', async () => {
      machineRoomRepoMock.getMachineRoomsByAuditId.mockResolvedValue([fakeMachineRoom])

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await getMachineRooms({ auditId: 'audit-1' }, { request: fakeRequest(UserRole.ADMIN) as any })

      expect(result).toEqual([fakeMachineRoom])
    })

    it('returns empty array when no rooms', async () => {
      machineRoomRepoMock.getMachineRoomsByAuditId.mockResolvedValue([])

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await getMachineRooms({ auditId: 'audit-1' }, { request: fakeRequest(UserRole.AUDITOR) as any })

      expect(result).toEqual([])
    })
  })

  describe('patchMachineRoom', () => {
    it('calls repo with correct args on happy path', async () => {
      auditRepoMock.getAuditOwnership.mockResolvedValue(fakeDraftOwnership)
      machineRoomRepoMock.getMachineRoomById.mockResolvedValue(fakeMachineRoom)
      machineRoomRepoMock.upsertMachineRoomData.mockResolvedValue({
        savedAt: '2026-05-16T10:00:00.000Z',
        roomId: 'mr-1',
      })
      const payload = { general: { machineRoomId: '1' } }

      const result = await patchMachineRoom(
        { auditId: 'audit-1', roomId: 'mr-1', data: payload },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { request: fakeRequest(UserRole.AUDITOR) as any },
      )

      expect(machineRoomRepoMock.upsertMachineRoomData).toHaveBeenCalledWith(fakeTx, {
        id: 'mr-1',
        auditId: 'audit-1',
        tenantId: 'tenant-a',
        data: payload,
      })
      expect(result).toEqual({ savedAt: '2026-05-16T10:00:00.000Z', roomId: 'mr-1' })
    })

    it('throws RoleNotPermittedError for non-AUDITOR', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(patchMachineRoom({ auditId: 'a', roomId: 'r', data: {} }, { request: fakeRequest(UserRole.ADMIN) as any }))
        .rejects.toMatchObject({ name: 'RoleNotPermittedError' })
    })

    it('throws AuditNotEditableError for non-DRAFT audit', async () => {
      auditRepoMock.getAuditOwnership.mockResolvedValue({ auditorUserId: 'user-1', status: AuditStatus.SUBMITTED })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(patchMachineRoom({ auditId: 'audit-1', roomId: 'mr-1', data: {} }, { request: fakeRequest(UserRole.AUDITOR) as any }))
        .rejects.toBeInstanceOf(AuditNotEditableError)
    })

    it('throws AuditNotEditableError for wrong owner', async () => {
      auditRepoMock.getAuditOwnership.mockResolvedValue({ auditorUserId: 'other', status: AuditStatus.DRAFT })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(patchMachineRoom({ auditId: 'audit-1', roomId: 'mr-1', data: {} }, { request: fakeRequest(UserRole.AUDITOR) as any }))
        .rejects.toBeInstanceOf(AuditNotEditableError)
    })
  })
})
