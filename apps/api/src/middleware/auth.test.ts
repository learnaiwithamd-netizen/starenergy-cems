import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { SignJWT } from 'jose'
import Fastify, { type FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { JWT_AUDIENCE, JWT_ISSUER, UserRole } from '@cems/types'
import { registerAuthHook, __testing__ } from './auth.js'
import { buildErrorHandler } from './error-handler.js'
import { __resetJwtSecretCacheForTests } from '../lib/tokens.js'

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

interface MakeTokenOpts {
  expirationTime?: string | number
  issuer?: string | null
  audience?: string | null
}

async function makeToken(claims: Record<string, unknown>, opts: MakeTokenOpts = {}): Promise<string> {
  let jwt = new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(opts.expirationTime ?? '5m')
  if (opts.issuer !== null) jwt = jwt.setIssuer(opts.issuer ?? JWT_ISSUER)
  if (opts.audience !== null) jwt = jwt.setAudience(opts.audience ?? JWT_AUDIENCE)
  return jwt.sign(new TextEncoder().encode(FAKE_JWT_SECRET))
}

describe('auth middleware', () => {
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

  it('rejects token without issuer claim', async () => {
    const app = await buildTestApp()
    const token = await makeToken(
      { sub: 'u', tenantId: 't', role: UserRole.ADMIN },
      { issuer: null },
    )
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/audits',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('rejects token with wrong audience', async () => {
    const app = await buildTestApp()
    const token = await makeToken(
      { sub: 'u', tenantId: 't', role: UserRole.ADMIN },
      { audience: 'someone-elses-api' },
    )
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/audits',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('returns RFC 7807 401 with token-expired slug when access token is expired', async () => {
    const app = await buildTestApp()
    // jose accepts string-or-numeric epoch; use a past unix timestamp.
    const expiredEpoch = Math.floor(Date.now() / 1000) - 60 // 60s ago
    const token = await makeToken(
      { sub: 'u', tenantId: 't', role: UserRole.AUDITOR, assignedStoreIds: [] },
      { expirationTime: expiredEpoch },
    )
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/audits',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(401)
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/)
    const body = JSON.parse(res.body)
    expect(body.type).toBe('https://cems.starenergy.ca/errors/token-expired')
    expect(body.title).toBe('Unauthorized')
    expect(body.status).toBe(401)
    await app.close()
  })

  it('handles Authorization header arriving as string[] (defensive)', async () => {
    const app = await buildTestApp()
    const token = await makeToken({
      sub: 'user-1',
      tenantId: 'tenant-a',
      role: UserRole.AUDITOR,
      assignedStoreIds: [],
    })
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/audits',
      // Fastify normalises duplicates to a comma-joined string in most envs,
      // but we exercise the array branch by passing the header twice.
      headers: { authorization: [`Bearer ${token}`, 'Bearer fake'] as unknown as string },
    })
    // Either 200 (first header wins, defensive cast worked) or a clean 401 —
    // never a 500 from a TypeError on .replace(). Assert no crash.
    expect([200, 401]).toContain(res.statusCode)
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
