import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { SignJWT } from 'jose'
import { JWT_AUDIENCE, JWT_ISSUER, UserRole } from '@cems/types'
import { __resetJwtSecretCacheForTests } from '../lib/tokens.js'
import { buildErrorHandler } from '../middleware/error-handler.js'
import { registerAuthHook } from '../middleware/auth.js'
import { registerTestRoutes } from './_test.routes.js'

const FAKE_JWT_SECRET = 'unit-test-secret-do-not-use-in-prod-min-32-chars-long'

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(sensible)
  app.setErrorHandler(buildErrorHandler())
  registerAuthHook(app)
  registerTestRoutes(app)
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

describe('GET /api/v1/_test/admin-only (synthetic role-guard test route)', () => {
  let originalSecret: string | undefined

  beforeAll(() => {
    originalSecret = process.env['JWT_SECRET']
  })

  beforeEach(() => {
    process.env['JWT_SECRET'] = FAKE_JWT_SECRET
    __resetJwtSecretCacheForTests()
  })

  afterEach(() => {
    if (originalSecret === undefined) delete process.env['JWT_SECRET']
    else process.env['JWT_SECRET'] = originalSecret
    __resetJwtSecretCacheForTests()
  })

  async function callWithRole(role: UserRole): Promise<{ statusCode: number; body: unknown }> {
    const app = await buildTestApp()
    const token = await makeToken({
      sub: 'user-1',
      tenantId: 'tenant-a',
      role,
      assignedStoreIds: [],
    })
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/_test/admin-only',
      headers: { authorization: `Bearer ${token}` },
    })
    await app.close()
    return { statusCode: res.statusCode, body: JSON.parse(res.body) }
  }

  it('200 with { status: "ok" } for ADMIN role', async () => {
    const res = await callWithRole(UserRole.ADMIN)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })

  it('403 RFC 7807 for AUDITOR role', async () => {
    const res = await callWithRole(UserRole.AUDITOR)
    expect(res.statusCode).toBe(403)
    expect(res.body).toMatchObject({
      type: 'https://cems.starenergy.ca/errors/forbidden',
      title: 'Forbidden',
      status: 403,
      detail: 'Role not permitted',
    })
  })

  it('403 RFC 7807 for CLIENT role', async () => {
    const res = await callWithRole(UserRole.CLIENT)
    expect(res.statusCode).toBe(403)
    expect((res.body as { type: string }).type).toBe('https://cems.starenergy.ca/errors/forbidden')
  })

  it('401 when no Authorization header is supplied (auth hook fires first)', async () => {
    const app = await buildTestApp()
    const res = await app.inject({ method: 'GET', url: '/api/v1/_test/admin-only' })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})
