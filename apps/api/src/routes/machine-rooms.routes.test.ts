import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { SignJWT } from 'jose'
import { JWT_AUDIENCE, JWT_ISSUER, UserRole } from '@cems/types'

const { fakeTx, machineRoomServiceMock } = vi.hoisted(() => ({
  fakeTx: Symbol('fake-tx'),
  machineRoomServiceMock: {
    getOrCreateMachineRoom: vi.fn(),
    getMachineRooms: vi.fn(),
    patchMachineRoom: vi.fn(),
  },
}))
vi.mock('../services/machine-room.service.js', () => machineRoomServiceMock)

import { __resetJwtSecretCacheForTests } from '../lib/tokens.js'
import { buildErrorHandler } from '../middleware/error-handler.js'
import { registerAuthHook } from '../middleware/auth.js'
import { registerMachineRoomsRoutes } from './machine-rooms.routes.js'
import { AuditNotEditableError } from '../lib/audit-errors.js'

const FAKE_JWT_SECRET = 'unit-test-secret-do-not-use-in-prod-min-32-chars-long'

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(sensible)
  app.setErrorHandler(buildErrorHandler())
  registerAuthHook(app)
  app.decorateRequest('withRls', null as unknown as never)
  app.addHook('preHandler', async (request) => {
    ;(request as unknown as { withRls: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T> }).withRls =
      (fn) => fn(fakeTx)
  })
  registerMachineRoomsRoutes(app)
  return app
}

async function makeToken(role: UserRole): Promise<string> {
  return new SignJWT({ sub: 'user-1', tenantId: 'tenant-a', role, assignedStoreIds: [] })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setSubject('user-1')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(new TextEncoder().encode(FAKE_JWT_SECRET))
}

const fakeMachineRoom = {
  id: 'mr-1',
  tenantId: 'tenant-a',
  auditId: 'audit-1',
  roomNumber: '1',
  data: {},
  createdAt: '2026-05-16T10:00:00.000Z',
  updatedAt: '2026-05-16T10:00:00.000Z',
}

describe('machine-rooms.routes', () => {
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

  describe('POST /api/v1/audits/:auditId/machine-rooms', () => {
    it('401 when no token', async () => {
      const app = await buildTestApp()
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/audits/audit-1/machine-rooms',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })
      expect(res.statusCode).toBe(401)
      await app.close()
    })

    it('200 happy path — returns machine room', async () => {
      machineRoomServiceMock.getOrCreateMachineRoom.mockResolvedValue(fakeMachineRoom)
      const app = await buildTestApp()
      const token = await makeToken(UserRole.AUDITOR)

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/audits/audit-1/machine-rooms',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body)).toMatchObject({ id: 'mr-1', auditId: 'audit-1' })
      await app.close()
    })

    it('200 idempotent — returns existing room', async () => {
      machineRoomServiceMock.getOrCreateMachineRoom.mockResolvedValue(fakeMachineRoom)
      const app = await buildTestApp()
      const token = await makeToken(UserRole.AUDITOR)

      // Called twice; both return 200 with the same room
      for (let i = 0; i < 2; i++) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/audits/audit-1/machine-rooms',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify({}),
        })
        expect(res.statusCode).toBe(200)
      }
      await app.close()
    })

    it('403 for ADMIN', async () => {
      const app = await buildTestApp()
      const token = await makeToken(UserRole.ADMIN)

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/audits/audit-1/machine-rooms',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(res.statusCode).toBe(403)
      await app.close()
    })

    it('403 for CLIENT', async () => {
      const app = await buildTestApp()
      const token = await makeToken(UserRole.CLIENT)

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/audits/audit-1/machine-rooms',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(res.statusCode).toBe(403)
      await app.close()
    })
  })

  describe('GET /api/v1/audits/:auditId/machine-rooms', () => {
    it('401 when no token', async () => {
      const app = await buildTestApp()
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/audits/audit-1/machine-rooms',
      })
      expect(res.statusCode).toBe(401)
      await app.close()
    })

    it('200 returns machine rooms list', async () => {
      machineRoomServiceMock.getMachineRooms.mockResolvedValue([fakeMachineRoom])
      const app = await buildTestApp()
      const token = await makeToken(UserRole.AUDITOR)

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/audits/audit-1/machine-rooms',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body) as { machineRooms: unknown[] }
      expect(body.machineRooms).toHaveLength(1)
      await app.close()
    })

    it('200 returns empty list', async () => {
      machineRoomServiceMock.getMachineRooms.mockResolvedValue([])
      const app = await buildTestApp()
      const token = await makeToken(UserRole.ADMIN)

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/audits/audit-1/machine-rooms',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body)).toEqual({ machineRooms: [] })
      await app.close()
    })
  })

  describe('PATCH /api/v1/audits/:auditId/machine-rooms/:roomId', () => {
    it('401 when no token', async () => {
      const app = await buildTestApp()
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/audits/audit-1/machine-rooms/mr-1',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ data: {} }),
      })
      expect(res.statusCode).toBe(401)
      await app.close()
    })

    it('200 happy path', async () => {
      machineRoomServiceMock.patchMachineRoom.mockResolvedValue({
        savedAt: '2026-05-16T10:00:00.000Z',
        roomId: 'mr-1',
      })
      const app = await buildTestApp()
      const token = await makeToken(UserRole.AUDITOR)

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/audits/audit-1/machine-rooms/mr-1',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ data: { general: { machineRoomId: '1' } } }),
      })

      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body)).toMatchObject({ roomId: 'mr-1' })
      await app.close()
    })

    it('403 for ADMIN', async () => {
      const app = await buildTestApp()
      const token = await makeToken(UserRole.ADMIN)

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/audits/audit-1/machine-rooms/mr-1',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ data: {} }),
      })

      expect(res.statusCode).toBe(403)
      await app.close()
    })

    it('404 when audit not editable', async () => {
      machineRoomServiceMock.patchMachineRoom.mockRejectedValue(new AuditNotEditableError())
      const app = await buildTestApp()
      const token = await makeToken(UserRole.AUDITOR)

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/audits/audit-1/machine-rooms/mr-1',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ data: {} }),
      })

      expect(res.statusCode).toBe(404)
      await app.close()
    })

    it('422 for missing required body field', async () => {
      const app = await buildTestApp()
      const token = await makeToken(UserRole.AUDITOR)

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/audits/audit-1/machine-rooms/mr-1',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(res.statusCode).toBe(422)
      await app.close()
    })
  })
})
