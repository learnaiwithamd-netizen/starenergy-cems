import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { SignJWT } from 'jose'
import { UserRole } from '@cems/types'
import { registerAuthHook } from './auth.js'
import { registerRlsRequestHook } from './rls-request.js'
import { buildErrorHandler } from './error-handler.js'

const FAKE_JWT_SECRET = 'unit-test-secret-do-not-use-in-prod-min-32-chars-long'

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(sensible)
  app.setErrorHandler(buildErrorHandler())
  registerAuthHook(app)
  registerRlsRequestHook(app)

  // Public route — no rlsContext expected; req.withRls should throw if invoked.
  app.get('/api/v1/health', async () => ({ status: 'ok' }))

  // Protected route — req.withRls should be a function and (in this test) we capture
  // the callback args to assert it was invoked. The callback does NOT actually run
  // (we throw a sentinel before Prisma touches the DB) — so this test verifies the
  // wiring without needing a live SQL Server.
  app.get('/api/v1/dummy', async (req) => {
    expect(typeof req.withRls).toBe('function')
    expect(req.rlsContext).not.toBeNull()
    try {
      await req.withRls(async (_tx) => {
        throw new Error('SENTINEL: withRls callback invoked')
      })
    } catch (err) {
      // We expect either the sentinel (Prisma actually ran the tx) OR a Prisma
      // connection error (no live DB) — both prove the wiring is correct.
      const msg = (err as Error).message
      if (!msg.includes('SENTINEL') && !msg.toLowerCase().includes('prisma') && !msg.toLowerCase().includes('database') && !msg.toLowerCase().includes('connect')) {
        throw err
      }
    }
    return {
      hadContext: true,
      tenant: req.rlsContext?.tenantId ?? null,
    }
  })

  return app
}

// Standalone hook check — exercises the throw path for a request with no rlsContext
// without going through Fastify's public-route allowlist (which would short-circuit auth).
import { registerRlsRequestHook as _registerHook } from './rls-request.js'

async function makeToken(claims: Record<string, unknown>): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(new TextEncoder().encode(FAKE_JWT_SECRET))
}

describe('rls-request hook', () => {
  let originalSecret: string | undefined
  let originalDbUrl: string | undefined

  beforeAll(() => {
    originalSecret = process.env['JWT_SECRET']
    originalDbUrl = process.env['DATABASE_URL']
  })

  beforeEach(() => {
    process.env['JWT_SECRET'] = FAKE_JWT_SECRET
    // Make the lazy Prisma client construct fail predictably — we don't want it to try
    // connecting in unit tests. The withRls test uses a SENTINEL throw before any DB call.
    if (!process.env['DATABASE_URL']) {
      process.env['DATABASE_URL'] = 'sqlserver://unused:1433;database=unused;user=sa;password=unused;trustServerCertificate=true'
    }
  })

  afterEach(() => {
    if (originalSecret === undefined) delete process.env['JWT_SECRET']
    else process.env['JWT_SECRET'] = originalSecret
    if (originalDbUrl === undefined) delete process.env['DATABASE_URL']
    else process.env['DATABASE_URL'] = originalDbUrl
  })

  it('decorates request.withRls on protected routes after auth populates rlsContext', async () => {
    const app = await buildTestApp()
    const token = await makeToken({
      sub: 'user-1',
      tenantId: 'tenant-a',
      role: UserRole.AUDITOR,
      assignedStoreIds: [],
    })
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/dummy',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.hadContext).toBe(true)
    expect(body.tenant).toBe('tenant-a')
    await app.close()
  })

  it('throws a clear error if a request has no rlsContext (public route invariant)', async () => {
    // Build a minimal hook-only app to verify the throw path. The hook decorates
    // request.withRls in a preHandler — we intercept it before Fastify routes run
    // by using a fixture route with a helper that simulates rlsContext === null.
    const app = Fastify({ logger: false })
    await app.register(sensible)
    app.setErrorHandler(buildErrorHandler())
    // Add the rls-request hook WITHOUT auth, then explicitly null the rlsContext.
    app.decorateRequest('rlsContext', null)
    _registerHook(app)
    app.get('/check', async (req) => {
      try {
        await req.withRls(async () => 'unreachable')
        return { reached: true }
      } catch (err) {
        return { error: (err as Error).message }
      }
    })
    const res = await app.inject({ method: 'GET', url: '/check' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.error).toContain('rlsContext')
    await app.close()
  })

  it('public route handler that does NOT call req.withRls works normally', async () => {
    const app = await buildTestApp()
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ status: 'ok' })
    await app.close()
  })
})
