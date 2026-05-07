import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { SignJWT } from 'jose'
import { JWT_AUDIENCE, JWT_ISSUER, UserRole } from '@cems/types'

const { fakeTx, repoMock } = vi.hoisted(() => ({
  fakeTx: Symbol('fake-tx'),
  repoMock: { listAuditsForCaller: vi.fn() },
}))
vi.mock('../repositories/audit.repo.js', () => repoMock)

import { __resetJwtSecretCacheForTests } from '../lib/tokens.js'
import { buildErrorHandler } from '../middleware/error-handler.js'
import { registerAuthHook } from '../middleware/auth.js'
import { registerAuditsRoutes } from './audits.routes.js'

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
  registerAuditsRoutes(app)
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

describe('audits.routes', () => {
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

  it('200 with empty array when no audits visible', async () => {
    repoMock.listAuditsForCaller.mockResolvedValue({ audits: [], total: 0 })
    const app = await buildTestApp()
    const token = await makeToken(UserRole.CLIENT, ['store-001'])
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/audits',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ audits: [], total: 0 })
    await app.close()
  })

  it('200 returns the seeded audits for a CLIENT caller', async () => {
    repoMock.listAuditsForCaller.mockResolvedValue({
      audits: [
        {
          id: 'a-1',
          storeId: 'store-001',
          status: 'DRAFT',
          createdAt: '2026-05-01T00:00:00.000Z',
          updatedAt: '2026-05-02T00:00:00.000Z',
        },
      ],
      total: 1,
    })
    const app = await buildTestApp()
    const token = await makeToken(UserRole.CLIENT, ['store-001'])
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/audits',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.audits).toHaveLength(1)
    expect(body.audits[0].id).toBe('a-1')
    await app.close()
  })

  it('200 — every authenticated role can list (no requireRole)', async () => {
    repoMock.listAuditsForCaller.mockResolvedValue({ audits: [], total: 0 })
    const app = await buildTestApp()
    for (const role of [UserRole.AUDITOR, UserRole.ADMIN, UserRole.CLIENT] as const) {
      const token = await makeToken(role, role === UserRole.CLIENT ? ['store-001'] : [])
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/audits',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(200)
    }
    await app.close()
  })

  it('401 without an Authorization header', async () => {
    const app = await buildTestApp()
    const res = await app.inject({ method: 'GET', url: '/api/v1/audits' })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})
