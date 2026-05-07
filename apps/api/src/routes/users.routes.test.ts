import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { SignJWT } from 'jose'
import { JWT_AUDIENCE, JWT_ISSUER, UserRole } from '@cems/types'

const { fakeTx, userServiceMock } = vi.hoisted(() => ({
  fakeTx: Symbol('fake-tx'),
  userServiceMock: {
    createUser: vi.fn(),
    updateUser: vi.fn(),
    listUsersByRole: vi.fn(),
    adminFindUserById: vi.fn(),
    SelfDeactivationError: class SelfDeactivationError extends Error {
      readonly statusCode = 400
      constructor(message = 'Admins cannot deactivate themselves') {
        super(message)
        this.name = 'SelfDeactivationError'
      }
    },
  },
}))
vi.mock('../services/user.service.js', () => userServiceMock)

import { __resetJwtSecretCacheForTests } from '../lib/tokens.js'
import { buildErrorHandler } from '../middleware/error-handler.js'
import { registerAuthHook } from '../middleware/auth.js'
import { registerUsersRoutes } from './users.routes.js'
import { UserEmailConflictError } from '../lib/auth-errors.js'

const FAKE_JWT_SECRET = 'unit-test-secret-do-not-use-in-prod-min-32-chars-long'

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(sensible)
  app.setErrorHandler(buildErrorHandler())
  registerAuthHook(app)
  // Stub request.withRls so user.service can call it without a Prisma client.
  app.decorateRequest('withRls', null as unknown as never)
  app.addHook('preHandler', async (request) => {
    ;(request as unknown as { withRls: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T> }).withRls =
      (fn) => fn(fakeTx)
  })
  registerUsersRoutes(app)
  return app
}

async function makeToken(role: UserRole, sub = 'user-1'): Promise<string> {
  return new SignJWT({ sub, tenantId: 'tenant-a', role, assignedStoreIds: [] })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(new TextEncoder().encode(FAKE_JWT_SECRET))
}

const sampleAdminUser = {
  id: 'user-99',
  tenantId: 'tenant-a',
  email: 'auditor@cems.local',
  name: 'Dev Auditor',
  role: UserRole.AUDITOR,
  status: 'ACTIVE' as const,
  assignedStoreIds: [] as string[],
  createdAt: '2026-05-07T00:00:00.000Z',
  updatedAt: '2026-05-07T00:00:00.000Z',
}

const sampleClientUser = {
  ...sampleAdminUser,
  id: 'user-100',
  email: 'client@cems.local',
  name: 'Dev Client',
  role: UserRole.CLIENT,
  assignedStoreIds: ['store-001', 'store-002'],
}

describe('users.routes', () => {
  let originalSecret: string | undefined

  beforeAll(() => {
    originalSecret = process.env['JWT_SECRET']
  })

  beforeEach(() => {
    process.env['JWT_SECRET'] = FAKE_JWT_SECRET
    __resetJwtSecretCacheForTests()
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (originalSecret === undefined) delete process.env['JWT_SECRET']
    else process.env['JWT_SECRET'] = originalSecret
    __resetJwtSecretCacheForTests()
  })

  describe('POST /api/v1/users', () => {
    it('201 creates an auditor for an ADMIN caller', async () => {
      userServiceMock.createUser.mockResolvedValue(sampleAdminUser)
      const app = await buildTestApp()
      const token = await makeToken(UserRole.ADMIN)
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/users',
        headers: { authorization: `Bearer ${token}` },
        payload: { email: 'auditor@cems.local', name: 'Dev Auditor', role: 'AUDITOR' },
      })
      expect(res.statusCode).toBe(201)
      expect(JSON.parse(res.body)).toEqual(sampleAdminUser)
      await app.close()
    })

    it('403 for AUDITOR caller (cross-role)', async () => {
      const app = await buildTestApp()
      const token = await makeToken(UserRole.AUDITOR)
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/users',
        headers: { authorization: `Bearer ${token}` },
        payload: { email: 'a@b.c', name: 'X', role: 'AUDITOR' },
      })
      expect(res.statusCode).toBe(403)
      const body = JSON.parse(res.body)
      expect(body.type).toBe('https://cems.starenergy.ca/errors/forbidden')
      await app.close()
    })

    it('403 for CLIENT caller (cross-role)', async () => {
      const app = await buildTestApp()
      const token = await makeToken(UserRole.CLIENT)
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/users',
        headers: { authorization: `Bearer ${token}` },
        payload: { email: 'a@b.c', name: 'X', role: 'AUDITOR' },
      })
      expect(res.statusCode).toBe(403)
      await app.close()
    })

    it('409 with fixed detail on duplicate email — does not echo the email', async () => {
      userServiceMock.createUser.mockRejectedValue(new UserEmailConflictError())
      const app = await buildTestApp()
      const token = await makeToken(UserRole.ADMIN)
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/users',
        headers: { authorization: `Bearer ${token}` },
        payload: { email: 'dup@cems.local', name: 'X', role: 'AUDITOR' },
      })
      expect(res.statusCode).toBe(409)
      const body = JSON.parse(res.body)
      expect(body.type).toBe('https://cems.starenergy.ca/errors/conflict')
      expect(body.detail).toBe('User with this email already exists')
      // No echoed email in the response payload.
      expect(JSON.stringify(body)).not.toContain('dup@cems.local')
      await app.close()
    })

    it('422 on invalid body', async () => {
      const app = await buildTestApp()
      const token = await makeToken(UserRole.ADMIN)
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/users',
        headers: { authorization: `Bearer ${token}` },
        payload: { email: 'not-an-email', name: '', role: 'AUDITOR' },
      })
      expect(res.statusCode).toBe(422)
      await app.close()
    })

    it('201 creates a CLIENT user with assignedStoreIds (Story 1.4)', async () => {
      userServiceMock.createUser.mockResolvedValue(sampleClientUser)
      const app = await buildTestApp()
      const token = await makeToken(UserRole.ADMIN)
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/users',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          email: 'client@cems.local',
          name: 'Dev Client',
          role: 'CLIENT',
          assignedStoreIds: ['store-001', 'store-002'],
        },
      })
      expect(res.statusCode).toBe(201)
      const body = JSON.parse(res.body)
      expect(body.role).toBe('CLIENT')
      expect(body.assignedStoreIds).toEqual(['store-001', 'store-002'])
      await app.close()
    })

    it('422 when AUDITOR is created with non-empty assignedStoreIds (refine)', async () => {
      const app = await buildTestApp()
      const token = await makeToken(UserRole.ADMIN)
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/users',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          email: 'a@b.c',
          name: 'Aud',
          role: 'AUDITOR',
          assignedStoreIds: ['store-001'],
        },
      })
      expect(res.statusCode).toBe(422)
      await app.close()
    })

    it('422 when role is ADMIN (only AUDITOR + CLIENT allowed)', async () => {
      const app = await buildTestApp()
      const token = await makeToken(UserRole.ADMIN)
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/users',
        headers: { authorization: `Bearer ${token}` },
        payload: { email: 'a@b.c', name: 'X', role: 'ADMIN' },
      })
      expect(res.statusCode).toBe(422)
      await app.close()
    })
  })

  describe('PATCH /api/v1/users/:id', () => {
    it('200 updates name', async () => {
      userServiceMock.updateUser.mockResolvedValue({
        user: sampleAdminUser,
        sessionsRevoked: 0,
        statusChanged: false,
        assignedStoreIdsChanged: false,
      })
      const app = await buildTestApp()
      const token = await makeToken(UserRole.ADMIN)
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/users/user-99',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'New Name' },
      })
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body)).toEqual(sampleAdminUser)
      await app.close()
    })

    it('200 updates assignedStoreIds (Story 1.4)', async () => {
      const updatedClient = { ...sampleClientUser, assignedStoreIds: ['store-003'] }
      userServiceMock.updateUser.mockResolvedValue({
        user: updatedClient,
        sessionsRevoked: 0,
        statusChanged: false,
        assignedStoreIdsChanged: true,
      })
      const app = await buildTestApp()
      const token = await makeToken(UserRole.ADMIN)
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/users/user-100',
        headers: { authorization: `Bearer ${token}` },
        payload: { assignedStoreIds: ['store-003'] },
      })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.assignedStoreIds).toEqual(['store-003'])
      // Verify the service was called with the right patch.
      const serviceCall = userServiceMock.updateUser.mock.calls[0]!
      expect(serviceCall[0]).toBe('user-100')
      expect(serviceCall[1]).toEqual({ assignedStoreIds: ['store-003'] })
      await app.close()
    })

    it('404 when user is in another tenant', async () => {
      userServiceMock.updateUser.mockResolvedValue(null)
      const app = await buildTestApp()
      const token = await makeToken(UserRole.ADMIN)
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/users/user-other-tenant',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'X' },
      })
      expect(res.statusCode).toBe(404)
      const body = JSON.parse(res.body)
      expect(body.detail).toBe('User not found in your tenant')
      await app.close()
    })

    it('422 on empty body', async () => {
      const app = await buildTestApp()
      const token = await makeToken(UserRole.ADMIN)
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/users/user-99',
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      })
      expect(res.statusCode).toBe(422)
      await app.close()
    })
  })

  describe('GET /api/v1/users', () => {
    it('200 returns the list for ADMIN with role=AUDITOR', async () => {
      userServiceMock.listUsersByRole.mockResolvedValue({ users: [sampleAdminUser], total: 1 })
      const app = await buildTestApp()
      const token = await makeToken(UserRole.ADMIN)
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/users?role=AUDITOR',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body)).toEqual({ users: [sampleAdminUser], total: 1 })
      await app.close()
    })

    it('403 for AUDITOR caller', async () => {
      const app = await buildTestApp()
      const token = await makeToken(UserRole.AUDITOR)
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/users?role=AUDITOR',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(403)
      await app.close()
    })
  })
})
