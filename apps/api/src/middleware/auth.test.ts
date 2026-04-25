import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { SignJWT } from 'jose'
import Fastify, { type FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { UserRole } from '@cems/types'
import { registerAuthHook, __testing__ } from './auth.js'
import { buildErrorHandler } from './error-handler.js'

const FAKE_JWT_SECRET = 'unit-test-secret-do-not-use-in-prod-min-32-chars-long'

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(sensible)
  app.setErrorHandler(buildErrorHandler())
  registerAuthHook(app)
  app.get('/api/v1/health', async () => ({ status: 'ok' }))
  app.get('/api/v1/audits', async (req) => ({
    tenant: req.rlsContext?.tenantId ?? null,
    user: req.rlsContext?.userId ?? null,
    role: req.rlsContext?.role ?? null,
  }))
  return app
}

async function makeToken(claims: Record<string, unknown>): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(new TextEncoder().encode(FAKE_JWT_SECRET))
}

describe('auth middleware', () => {
  let originalSecret: string | undefined

  beforeAll(() => {
    originalSecret = process.env['JWT_SECRET']
  })

  beforeEach(() => {
    process.env['JWT_SECRET'] = FAKE_JWT_SECRET
  })

  afterEach(() => {
    if (originalSecret === undefined) delete process.env['JWT_SECRET']
    else process.env['JWT_SECRET'] = originalSecret
  })

  it('public routes (health) skip auth check', async () => {
    const app = await buildTestApp()
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ status: 'ok' })
    await app.close()
  })

  it('returns RFC 7807 401 when Authorization header is missing', async () => {
    const app = await buildTestApp()
    const res = await app.inject({ method: 'GET', url: '/api/v1/audits' })
    expect(res.statusCode).toBe(401)
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/)
    const body = JSON.parse(res.body)
    expect(body.type).toBe('https://cems.starenergy.ca/errors/authentication-required')
    expect(body.title).toBe('Unauthorized')
    expect(body.status).toBe(401)
    expect(body.instance).toBe('/api/v1/audits')
    await app.close()
  })

  it('returns 401 when bearer token is malformed', async () => {
    const app = await buildTestApp()
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/audits',
      headers: { authorization: 'Bearer not-a-real-token' },
    })
    expect(res.statusCode).toBe(401)
    const body = JSON.parse(res.body)
    expect(body.type).toBe('https://cems.starenergy.ca/errors/authentication-required')
    await app.close()
  })

  it('valid token populates request.rlsContext on protected routes', async () => {
    const app = await buildTestApp()
    const token = await makeToken({
      sub: 'user-1',
      tenantId: 'tenant-a',
      role: UserRole.AUDITOR,
      assignedStoreIds: ['store-1', 'store-2'],
    })
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/audits',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ tenant: 'tenant-a', user: 'user-1', role: 'AUDITOR' })
    await app.close()
  })

  it('rejects token with bad role enum value', async () => {
    const app = await buildTestApp()
    const token = await makeToken({
      sub: 'user-1',
      tenantId: 'tenant-a',
      role: 'SUPER_ADMIN',
    })
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/audits',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  describe('isPublicRoute helper', () => {
    it('treats /api/v1/docs and subpaths as public', () => {
      expect(__testing__.isPublicRoute('/api/v1/docs')).toBe(true)
      expect(__testing__.isPublicRoute('/api/v1/docs/json')).toBe(true)
      expect(__testing__.isPublicRoute('/api/v1/docs/static/main.css')).toBe(true)
    })

    it('does not treat /api/v1/audits as public', () => {
      expect(__testing__.isPublicRoute('/api/v1/audits')).toBe(false)
      expect(__testing__.isPublicRoute('/api/v1/audits/123')).toBe(false)
    })
  })
})
