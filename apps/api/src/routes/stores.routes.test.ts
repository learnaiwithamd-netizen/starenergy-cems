import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { SignJWT } from 'jose'
import { JWT_AUDIENCE, JWT_ISSUER, UserRole } from '@cems/types'

const { fakeTx, serviceMock } = vi.hoisted(() => ({
  fakeTx: Symbol('fake-tx'),
  serviceMock: { listStoresForCaller: vi.fn() },
}))
vi.mock('../services/store.service.js', () => serviceMock)

import { __resetJwtSecretCacheForTests } from '../lib/tokens.js'
import { buildErrorHandler } from '../middleware/error-handler.js'
import { registerAuthHook } from '../middleware/auth.js'
import { registerStoresRoutes } from './stores.routes.js'

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
  registerStoresRoutes(app)
  return app
}

async function makeToken(role: UserRole, assignedStoreIds: string[] = []): Promise<string> {
  return new SignJWT({ sub: 'user-1', tenantId: 'tenant-a', role, assignedStoreIds })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setSubject('user-1')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(new TextEncoder().encode(FAKE_JWT_SECRET))
}

const sampleStores = [
  {
    id: 'a',
    storeNumber: 'STORE-001',
    storeName: 'Sobeys A',
    banner: 'Sobeys',
    region: 'ON',
  },
]

describe('GET /api/v1/stores', () => {
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

  it('200 returns stores for an AUDITOR caller with assignedToUser=true', async () => {
    serviceMock.listStoresForCaller.mockResolvedValue({ stores: sampleStores, total: 1 })
    const app = await buildTestApp()
    const token = await makeToken(UserRole.AUDITOR, ['a'])
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/stores?assignedToUser=true',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ stores: sampleStores, total: 1 })
    // Verify the parsed query reached the service.
    const callArg = serviceMock.listStoresForCaller.mock.calls[0]![0]
    expect(callArg).toMatchObject({ assignedToUser: true })
    await app.close()
  })

  it('200 — every authenticated role can list (no requireRole)', async () => {
    serviceMock.listStoresForCaller.mockResolvedValue({ stores: [], total: 0 })
    const app = await buildTestApp()
    for (const role of [UserRole.AUDITOR, UserRole.ADMIN, UserRole.CLIENT] as const) {
      const token = await makeToken(role, role === UserRole.CLIENT ? ['a'] : [])
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/stores',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(200)
    }
    await app.close()
  })

  it('coerces ?assignedToUser=true (string) to boolean true', async () => {
    serviceMock.listStoresForCaller.mockResolvedValue({ stores: [], total: 0 })
    const app = await buildTestApp()
    const token = await makeToken(UserRole.ADMIN)
    await app.inject({
      method: 'GET',
      url: '/api/v1/stores?assignedToUser=true',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(serviceMock.listStoresForCaller.mock.calls[0]![0].assignedToUser).toBe(true)
    await app.close()
  })

  it('default (no query) → assignedToUser=false', async () => {
    serviceMock.listStoresForCaller.mockResolvedValue({ stores: [], total: 0 })
    const app = await buildTestApp()
    const token = await makeToken(UserRole.AUDITOR)
    await app.inject({
      method: 'GET',
      url: '/api/v1/stores',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(serviceMock.listStoresForCaller.mock.calls[0]![0].assignedToUser).toBe(false)
    await app.close()
  })

  it('401 without an Authorization header', async () => {
    const app = await buildTestApp()
    const res = await app.inject({ method: 'GET', url: '/api/v1/stores' })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})
