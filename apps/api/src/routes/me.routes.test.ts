import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { SignJWT } from 'jose'
import { JWT_AUDIENCE, JWT_ISSUER, UserRole } from '@cems/types'

const { fakeTx, userRepoMock } = vi.hoisted(() => ({
  fakeTx: Symbol('fake-tx'),
  userRepoMock: { findActiveUserById: vi.fn(), findActiveUserByEmail: vi.fn() },
}))
vi.mock('../repositories/user.repo.js', () => userRepoMock)

import { __resetJwtSecretCacheForTests } from '../lib/tokens.js'
import { buildErrorHandler } from '../middleware/error-handler.js'
import { registerAuthHook } from '../middleware/auth.js'
import { registerMeRoutes } from './me.routes.js'

const FAKE_JWT_SECRET = 'unit-test-secret-do-not-use-in-prod-min-32-chars-long'

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(sensible)
  app.setErrorHandler(buildErrorHandler())
  registerAuthHook(app)
  // Stand-in for registerRlsRequestHook — the routes call request.withRls,
  // so we decorate it with a stub that just calls the function with our
  // hoisted fakeTx (no real Prisma needed for this test).
  app.decorateRequest('withRls', null as unknown as never)
  app.addHook('preHandler', async (request) => {
    ;(request as unknown as { withRls: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T> }).withRls =
      (fn) => fn(fakeTx)
  })
  registerMeRoutes(app)
  return app
}

async function makeToken(claims: Record<string, unknown>): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(new TextEncoder().encode(FAKE_JWT_SECRET))
}

describe('GET /api/v1/me', () => {
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

  it('200 returns the user profile for an authenticated request', async () => {
    userRepoMock.findActiveUserById.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-a',
      email: 'auditor@cems.local',
      name: 'Dev Auditor',
      role: UserRole.AUDITOR,
      status: 'ACTIVE',
      passwordHash: '$argon2id$...',
      assignedStoreIds: ['store-1'],
    })

    const app = await buildTestApp()
    const token = await makeToken({
      sub: 'user-1',
      tenantId: 'tenant-a',
      role: UserRole.AUDITOR,
      assignedStoreIds: ['store-1'],
    })
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({
      id: 'user-1',
      email: 'auditor@cems.local',
      name: 'Dev Auditor',
      role: UserRole.AUDITOR,
      tenantId: 'tenant-a',
      assignedStoreIds: ['store-1'],
    })
    await app.close()
  })

  it('401 when the user no longer exists in the DB (token still valid)', async () => {
    userRepoMock.findActiveUserById.mockResolvedValue(null)

    const app = await buildTestApp()
    const token = await makeToken({
      sub: 'user-deleted',
      tenantId: 'tenant-a',
      role: UserRole.AUDITOR,
      assignedStoreIds: [],
    })
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(401)
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/)
    const body = JSON.parse(res.body)
    expect(body.type).toBe('https://cems.starenergy.ca/errors/authentication-required')
    expect(body.detail).toBe('User no longer exists')
    await app.close()
  })

  it('returns LIVE assignedStoreIds from the DB row, NOT the (stale) JWT claim — Story 1.4', async () => {
    // DB row: 2 assigned stores. JWT claim: 1 assigned store (stale).
    // /me must return the LIVE list, so the SPA can detect drift and trigger
    // a refresh.
    userRepoMock.findActiveUserById.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-a',
      email: 'client@cems.local',
      name: 'Dev Client',
      role: UserRole.CLIENT,
      status: 'ACTIVE',
      passwordHash: '$argon2id$...',
      assignedStoreIds: ['store-001', 'store-002'], // LIVE
    })
    const app = await buildTestApp()
    const token = await makeToken({
      sub: 'user-1',
      tenantId: 'tenant-a',
      role: UserRole.CLIENT,
      assignedStoreIds: ['store-001'], // STALE
    })
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.assignedStoreIds).toEqual(['store-001', 'store-002'])
    await app.close()
  })

  it('401 when the user is INACTIVE (Story 1.3)', async () => {
    userRepoMock.findActiveUserById.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-a',
      email: 'auditor@cems.local',
      name: 'Dev Auditor',
      role: UserRole.AUDITOR,
      status: 'INACTIVE',
      passwordHash: '$argon2id$...',
      assignedStoreIds: [],
    })
    const app = await buildTestApp()
    const token = await makeToken({
      sub: 'user-1',
      tenantId: 'tenant-a',
      role: UserRole.AUDITOR,
      assignedStoreIds: [],
    })
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(401)
    const body = JSON.parse(res.body)
    expect(body.detail).toBe('User account is not active')
    await app.close()
  })

  it('401 when no Authorization header is supplied', async () => {
    const app = await buildTestApp()
    const res = await app.inject({ method: 'GET', url: '/api/v1/me' })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})
