import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UserRole } from '@cems/types'

const { fakeTx, userRepoMock, passwordSetTokenRepoMock, sessionRepoMock, auditLogRepoMock, queueMock } =
  vi.hoisted(() => ({
    fakeTx: Symbol('fake-tx'),
    userRepoMock: {
      createUser: vi.fn(),
      updateUser: vi.fn(),
      listUsersByRole: vi.fn(),
      findUserByIdInTenant: vi.fn(),
    },
    passwordSetTokenRepoMock: {
      createPasswordSetToken: vi.fn(),
    },
    sessionRepoMock: {
      deleteSessionsByUserId: vi.fn(),
    },
    auditLogRepoMock: {
      appendLog: vi.fn(),
    },
    queueMock: { add: vi.fn() },
  }))

vi.mock('../repositories/user.repo.js', () => userRepoMock)
vi.mock('../repositories/password-set-token.repo.js', () => passwordSetTokenRepoMock)
vi.mock('../repositories/user-session.repo.js', () => sessionRepoMock)
vi.mock('../repositories/audit-log.repo.js', () => auditLogRepoMock)
vi.mock('../jobs/queue.js', () => ({
  getEmailNotificationQueue: () => queueMock,
}))

import { adminFindUserById, createAuditor, listUsersByRole, updateUser, SelfDeactivationError } from './user.service.js'
import { UserEmailConflictError } from '../lib/auth-errors.js'

interface FakeRequest {
  rlsContext: { tenantId: string; userId: string; role: UserRole; assignedStoreIds: string[] } | null
  withRls: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T>
}

function fakeRequest(role: UserRole = UserRole.ADMIN, userId = 'admin-1'): FakeRequest {
  return {
    rlsContext: { tenantId: 'tenant-a', userId, role, assignedStoreIds: [] },
    withRls: <T>(fn: (tx: unknown) => Promise<T>) => fn(fakeTx),
  }
}

const seededAdmin = {
  id: 'user-99',
  tenantId: 'tenant-a',
  email: 'auditor@cems.local',
  name: 'Dev Auditor',
  role: UserRole.AUDITOR,
  status: 'ACTIVE' as const,
  createdAt: '2026-05-07T00:00:00.000Z',
  updatedAt: '2026-05-07T00:00:00.000Z',
}

describe('user.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('createAuditor', () => {
    it('creates the user, persists a token, enqueues the welcome email, audits', async () => {
      userRepoMock.createUser.mockResolvedValue(seededAdmin)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const created = await createAuditor(
        { email: 'auditor@cems.local', name: 'Dev Auditor', role: UserRole.AUDITOR },
        { request: fakeRequest() as any },
      )

      expect(created).toEqual(seededAdmin)
      expect(userRepoMock.createUser).toHaveBeenCalledOnce()
      expect(passwordSetTokenRepoMock.createPasswordSetToken).toHaveBeenCalledOnce()
      expect(queueMock.add).toHaveBeenCalledOnce()
      const enqueueArg = queueMock.add.mock.calls[0]![1]
      expect(enqueueArg).toMatchObject({
        to: 'auditor@cems.local',
        templateId: 'auditor-welcome',
        tenantId: 'tenant-a',
      })
      expect(enqueueArg.variables.link).toMatch(/\/set-password\?token=/)
      expect(auditLogRepoMock.appendLog).toHaveBeenCalledWith(
        fakeTx,
        expect.objectContaining({ eventType: 'USER_CREATED' }),
      )
    })

    it('maps Prisma P2002 to UserEmailConflictError', async () => {
      userRepoMock.createUser.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }))
      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        createAuditor(
          { email: 'dup@cems.local', name: 'Dup', role: UserRole.AUDITOR },
          { request: fakeRequest() as any },
        ),
      ).rejects.toBeInstanceOf(UserEmailConflictError)
      expect(queueMock.add).not.toHaveBeenCalled()
    })
  })

  describe('updateUser', () => {
    it('updates the user, audits USER_UPDATED, no session revocation', async () => {
      userRepoMock.updateUser.mockResolvedValue(seededAdmin)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await updateUser('user-99', { name: 'New Name' }, { request: fakeRequest() as any })
      expect(res?.user).toEqual(seededAdmin)
      expect(res?.sessionsRevoked).toBe(0)
      expect(sessionRepoMock.deleteSessionsByUserId).not.toHaveBeenCalled()
      expect(auditLogRepoMock.appendLog).toHaveBeenCalledWith(
        fakeTx,
        expect.objectContaining({ eventType: 'USER_UPDATED' }),
      )
    })

    it('on status: INACTIVE → deletes sessions atomically + audits USER_DEACTIVATED', async () => {
      userRepoMock.updateUser.mockResolvedValue({ ...seededAdmin, status: 'INACTIVE' })
      sessionRepoMock.deleteSessionsByUserId.mockResolvedValue({ count: 3 })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await updateUser('user-99', { status: 'INACTIVE' }, { request: fakeRequest() as any })

      expect(res?.sessionsRevoked).toBe(3)
      expect(sessionRepoMock.deleteSessionsByUserId).toHaveBeenCalledWith(fakeTx, 'user-99')
      expect(auditLogRepoMock.appendLog).toHaveBeenCalledWith(
        fakeTx,
        expect.objectContaining({ eventType: 'USER_DEACTIVATED' }),
      )
    })

    it('refuses self-deactivation', async () => {
      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        updateUser('admin-1', { status: 'INACTIVE' }, { request: fakeRequest(UserRole.ADMIN, 'admin-1') as any }),
      ).rejects.toBeInstanceOf(SelfDeactivationError)
      expect(userRepoMock.updateUser).not.toHaveBeenCalled()
    })

    it('returns null when user is in another tenant (P2025)', async () => {
      userRepoMock.updateUser.mockResolvedValue(null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await updateUser('user-other', { name: 'X' }, { request: fakeRequest() as any })
      expect(res).toBeNull()
    })

    it('maps Prisma P2002 to UserEmailConflictError on email change', async () => {
      userRepoMock.updateUser.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }))
      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        updateUser('user-99', { email: 'dup@cems.local' }, { request: fakeRequest() as any }),
      ).rejects.toBeInstanceOf(UserEmailConflictError)
    })
  })

  describe('listUsersByRole', () => {
    it('delegates to repo via withRls', async () => {
      userRepoMock.listUsersByRole.mockResolvedValue({ users: [seededAdmin], total: 1 })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await listUsersByRole(UserRole.AUDITOR, undefined, { request: fakeRequest() as any })
      expect(res.total).toBe(1)
      expect(userRepoMock.listUsersByRole).toHaveBeenCalledWith(fakeTx, { role: UserRole.AUDITOR })
    })
  })

  describe('adminFindUserById', () => {
    it('returns the user when found in tenant', async () => {
      userRepoMock.findUserByIdInTenant.mockResolvedValue({
        id: 'user-99',
        tenantId: 'tenant-a',
        email: 'auditor@cems.local',
        name: 'Dev Auditor',
        role: UserRole.AUDITOR,
        status: 'ACTIVE',
        passwordHash: '...',
        assignedStoreIds: [],
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await adminFindUserById('user-99', { request: fakeRequest() as any })
      expect(res?.id).toBe('user-99')
    })

    it('returns null when not in tenant', async () => {
      userRepoMock.findUserByIdInTenant.mockResolvedValue(null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(await adminFindUserById('nope', { request: fakeRequest() as any })).toBeNull()
    })
  })
})
