import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { SignJWT } from 'jose'
import { JWT_AUDIENCE, JWT_ISSUER, UserRole } from '@cems/types'

const { fakeTx, rackServiceMock } = vi.hoisted(() => ({
  fakeTx: Symbol('fake-tx'),
  rackServiceMock: {
    createRack: vi.fn(),
    getRacks: vi.fn(),
    getRackById: vi.fn(),
    patchRack: vi.fn(),
    duplicateRack: vi.fn(),
  },
}))
vi.mock('../services/rack.service.js', () => rackServiceMock)

import { __resetJwtSecretCacheForTests } from '../lib/tokens.js'
import { buildErrorHandler } from '../middleware/error-handler.js'
import { registerAuthHook } from '../middleware/auth.js'
import { registerRacksRoutes } from './racks.routes.js'
import { RackNotFoundError } from '../lib/audit-errors.js'

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
  registerRacksRoutes(app)
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

const fakeRack = {
  id: 'rack-1',
  tenantId: 'tenant-a',
  machineRoomId: 'mr-1',
  rackNumber: '1',
  data: {},
  createdAt: '2026-05-16T10:00:00.000Z',
  updatedAt: '2026-05-16T10:00:00.000Z',
}

const BASE = '/api/v1/audits/audit-1/machine-rooms/mr-1/racks'

describe('racks.routes', () => {
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

  describe('POST /racks (+ /duplicate)', () => {
    it('401 when no token', async () => {
      const app = await buildTestApp()
      const res = await app.inject({
        method: 'POST',
        url: BASE,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })
      expect(res.statusCode).toBe(401)
      await app.close()
    })

    it('200 happy path — returns created rack', async () => {
      rackServiceMock.createRack.mockResolvedValue(fakeRack)
      const app = await buildTestApp()
      const token = await makeToken(UserRole.AUDITOR)

      const res = await app.inject({
        method: 'POST',
        url: BASE,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body)).toMatchObject({ id: 'rack-1', machineRoomId: 'mr-1' })
      await app.close()
    })

    it('403 for ADMIN on create', async () => {
      const app = await buildTestApp()
      const token = await makeToken(UserRole.ADMIN)

      const res = await app.inject({
        method: 'POST',
        url: BASE,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(res.statusCode).toBe(403)
      await app.close()
    })

    it('200 duplicate — returns the new rack', async () => {
      rackServiceMock.duplicateRack.mockResolvedValue({ ...fakeRack, id: 'rack-2', rackNumber: '2' })
      const app = await buildTestApp()
      const token = await makeToken(UserRole.AUDITOR)

      const res = await app.inject({
        method: 'POST',
        url: `${BASE}/rack-1/duplicate`,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body)).toMatchObject({ id: 'rack-2' })
      await app.close()
    })

    it('404 when duplicate source rack not found', async () => {
      rackServiceMock.duplicateRack.mockRejectedValue(new RackNotFoundError())
      const app = await buildTestApp()
      const token = await makeToken(UserRole.AUDITOR)

      const res = await app.inject({
        method: 'POST',
        url: `${BASE}/gone/duplicate`,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(res.statusCode).toBe(404)
      await app.close()
    })
  })

  describe('GET /racks (list + single)', () => {
    it('401 when no token', async () => {
      const app = await buildTestApp()
      const res = await app.inject({ method: 'GET', url: BASE })
      expect(res.statusCode).toBe(401)
      await app.close()
    })

    it('200 returns rack list', async () => {
      rackServiceMock.getRacks.mockResolvedValue([fakeRack])
      const app = await buildTestApp()
      const token = await makeToken(UserRole.AUDITOR)

      const res = await app.inject({
        method: 'GET',
        url: BASE,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body)).toEqual({ racks: [fakeRack] })
      await app.close()
    })

    it('403 for CLIENT (not part of the client surface)', async () => {
      const app = await buildTestApp()
      const token = await makeToken(UserRole.CLIENT)

      const res = await app.inject({
        method: 'GET',
        url: BASE,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(403)
      await app.close()
    })

    it('200 returns a single rack', async () => {
      rackServiceMock.getRackById.mockResolvedValue(fakeRack)
      const app = await buildTestApp()
      const token = await makeToken(UserRole.AUDITOR)

      const res = await app.inject({
        method: 'GET',
        url: `${BASE}/rack-1`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body)).toMatchObject({ id: 'rack-1' })
      await app.close()
    })

    it('404 when single rack not found', async () => {
      rackServiceMock.getRackById.mockRejectedValue(new RackNotFoundError())
      const app = await buildTestApp()
      const token = await makeToken(UserRole.AUDITOR)

      const res = await app.inject({
        method: 'GET',
        url: `${BASE}/gone`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
      await app.close()
    })
  })

  describe('PATCH /racks/:rackId', () => {
    it('401 when no token', async () => {
      const app = await buildTestApp()
      const res = await app.inject({
        method: 'PATCH',
        url: `${BASE}/rack-1`,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ data: {} }),
      })
      expect(res.statusCode).toBe(401)
      await app.close()
    })

    it('200 happy path', async () => {
      rackServiceMock.patchRack.mockResolvedValue({ savedAt: '2026-05-16T10:00:00.000Z', rackId: 'rack-1' })
      const app = await buildTestApp()
      const token = await makeToken(UserRole.AUDITOR)

      const res = await app.inject({
        method: 'PATCH',
        url: `${BASE}/rack-1`,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ data: { general: { rackDesignation: 'A' } } }),
      })

      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body)).toMatchObject({ rackId: 'rack-1' })
      await app.close()
    })

    it('403 for ADMIN', async () => {
      const app = await buildTestApp()
      const token = await makeToken(UserRole.ADMIN)

      const res = await app.inject({
        method: 'PATCH',
        url: `${BASE}/rack-1`,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ data: {} }),
      })

      expect(res.statusCode).toBe(403)
      await app.close()
    })

    it('404 when rack not found', async () => {
      rackServiceMock.patchRack.mockRejectedValue(new RackNotFoundError())
      const app = await buildTestApp()
      const token = await makeToken(UserRole.AUDITOR)

      const res = await app.inject({
        method: 'PATCH',
        url: `${BASE}/gone`,
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
        url: `${BASE}/rack-1`,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(res.statusCode).toBe(422)
      await app.close()
    })
  })
})
