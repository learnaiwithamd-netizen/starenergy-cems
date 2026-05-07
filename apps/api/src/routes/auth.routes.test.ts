import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { JWT_AUDIENCE, JWT_ISSUER, UserRole } from '@cems/types'

const { fakeTx, userRepoMock, sessionRepoMock } = vi.hoisted(() => ({
  fakeTx: Symbol('fake-tx'),
  userRepoMock: {
    findActiveUserByEmail: vi.fn(),
    findActiveUserById: vi.fn(),
  },
  sessionRepoMock: {
    createSession: vi.fn(),
    deleteSessionByHash: vi.fn(),
    findActiveSessionByHash: vi.fn(),
  },
}))

vi.mock('../lib/system-auth-context.js', () => ({
  SYSTEM_AUTH_CONTEXT: { tenantId: '__auth_system__' },
  withSystemAuth: <T>(fn: (tx: unknown) => Promise<T>) => fn(fakeTx),
}))
vi.mock('../repositories/user.repo.js', () => userRepoMock)
vi.mock('../repositories/user-session.repo.js', () => sessionRepoMock)

import { hashPassword } from '../lib/passwords.js'
import { __resetJwtSecretCacheForTests, getJwtSecret, hashRefreshToken } from '../lib/tokens.js'
import { jwtVerify } from 'jose'
import { buildErrorHandler } from '../middleware/error-handler.js'
import { registerAuthHook } from '../middleware/auth.js'
import { registerAuthRoutes } from './auth.routes.js'

const FAKE_JWT_SECRET = 'unit-test-secret-do-not-use-in-prod-min-32-chars-long'

const seededUser = {
  id: 'user-1',
  tenantId: 'tenant-a',
  email: 'auditor@cems.local',
  role: UserRole.AUDITOR,
  passwordHash: '',
  assignedStoreIds: ['store-1'],
}

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(sensible)
  app.setErrorHandler(buildErrorHandler())
  registerAuthHook(app)
  registerAuthRoutes(app)
  return app
}

describe('auth.routes', () => {
  let originalSecret: string | undefined

  beforeAll(async () => {
    originalSecret = process.env['JWT_SECRET']
    seededUser.passwordHash = await hashPassword('correct-password')
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

  // ─── POST /auth/login ──────────────────────────────────────────────

  describe('POST /api/v1/auth/login', () => {
    it('200 with token pair on valid credentials', async () => {
      userRepoMock.findActiveUserByEmail.mockResolvedValue(seededUser)
      sessionRepoMock.createSession.mockResolvedValue({ id: 'sess-1' })

      const app = await buildTestApp()
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'auditor@cems.local', password: 'correct-password' },
      })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.tokenType).toBe('Bearer')
      expect(body.expiresIn).toBe(8 * 60 * 60)
      const { payload } = await jwtVerify(body.accessToken, getJwtSecret(), {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      })
      expect(payload.sub).toBe('user-1')
      await app.close()
    })

    it('401 RFC 7807 on wrong password — no email/password leak in detail', async () => {
      userRepoMock.findActiveUserByEmail.mockResolvedValue(seededUser)
      const app = await buildTestApp()
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'auditor@cems.local', password: 'WRONG' },
      })
      expect(res.statusCode).toBe(401)
      expect(res.headers['content-type']).toMatch(/application\/problem\+json/)
      const body = JSON.parse(res.body)
      expect(body.type).toBe('https://cems.starenergy.ca/errors/authentication-required')
      expect(body.detail).toBe('Invalid email or password')
      // Generic message — does not echo the email anywhere.
      expect(JSON.stringify(body)).not.toContain('auditor@cems.local')
      await app.close()
    })

    it('401 with the same shape on unknown email (no enumeration)', async () => {
      userRepoMock.findActiveUserByEmail.mockResolvedValue(null)
      const app = await buildTestApp()
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'nobody@cems.local', password: 'whatever' },
      })
      expect(res.statusCode).toBe(401)
      const body = JSON.parse(res.body)
      expect(body.type).toBe('https://cems.starenergy.ca/errors/authentication-required')
      expect(body.detail).toBe('Invalid email or password')
      await app.close()
    })

    it('422 on empty email', async () => {
      const app = await buildTestApp()
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: '', password: 'whatever' },
      })
      expect(res.statusCode).toBe(422)
      await app.close()
    })

    it('lowercases the email before lookup', async () => {
      // Note: leading/trailing whitespace is rejected by Ajv's email format
      // BEFORE the route handler runs Zod's .trim() — so this asserts only
      // the lowercase transform, which Zod applies in the handler's parse().
      userRepoMock.findActiveUserByEmail.mockResolvedValue(null)
      const app = await buildTestApp()
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'AUDITOR@CEMS.LOCAL', password: 'whatever' },
      })
      expect(userRepoMock.findActiveUserByEmail).toHaveBeenCalledWith(
        fakeTx,
        'auditor@cems.local',
      )
      await app.close()
    })
  })

  // ─── POST /auth/refresh ────────────────────────────────────────────

  describe('POST /api/v1/auth/refresh', () => {
    it('200 rotates the refresh token', async () => {
      const oldTok = 'old-refresh'
      const oldHash = hashRefreshToken(oldTok)
      sessionRepoMock.findActiveSessionByHash.mockResolvedValue({
        id: 'sess-old',
        tenantId: 'tenant-a',
        userId: 'user-1',
        refreshTokenHash: oldHash,
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
      })
      userRepoMock.findActiveUserById.mockResolvedValue(seededUser)
      sessionRepoMock.deleteSessionByHash.mockResolvedValue({ count: 1 })
      sessionRepoMock.createSession.mockResolvedValue({ id: 'sess-new' })

      const app = await buildTestApp()
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: { refreshToken: oldTok },
      })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.refreshToken).not.toBe(oldTok)
      expect(sessionRepoMock.deleteSessionByHash).toHaveBeenCalledWith(fakeTx, oldHash)
      await app.close()
    })

    it('401 with same shape when the refresh token is unknown', async () => {
      sessionRepoMock.findActiveSessionByHash.mockResolvedValue(null)
      const app = await buildTestApp()
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: { refreshToken: 'unknown' },
      })
      expect(res.statusCode).toBe(401)
      const body = JSON.parse(res.body)
      expect(body.type).toBe('https://cems.starenergy.ca/errors/authentication-required')
      await app.close()
    })

    it('does NOT require an Authorization header (public route)', async () => {
      // Confirms /auth/refresh is in PUBLIC_ROUTES — no Authorization header
      // attached, and the request still reaches the route handler (which
      // then 401s on its own merits because the refresh token is unknown).
      sessionRepoMock.findActiveSessionByHash.mockResolvedValue(null)
      const app = await buildTestApp()
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: { refreshToken: 'whatever' },
      })
      // 401 from credentials, NOT from missing Authorization header.
      expect(res.statusCode).toBe(401)
      const body = JSON.parse(res.body)
      expect(body.detail).toBe('Invalid email or password')
      await app.close()
    })
  })

  // ─── POST /auth/logout ─────────────────────────────────────────────

  describe('POST /api/v1/auth/logout', () => {
    it('204 on valid refresh token', async () => {
      sessionRepoMock.deleteSessionByHash.mockResolvedValue({ count: 1 })
      const app = await buildTestApp()
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        payload: { refreshToken: 'some-token' },
      })
      expect(res.statusCode).toBe(204)
      expect(res.body).toBe('')
      await app.close()
    })

    it('204 (idempotent) on unknown refresh token', async () => {
      sessionRepoMock.deleteSessionByHash.mockResolvedValue({ count: 0 })
      const app = await buildTestApp()
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        payload: { refreshToken: 'unknown' },
      })
      expect(res.statusCode).toBe(204)
      await app.close()
    })

    it('does NOT require an Authorization header (public route)', async () => {
      sessionRepoMock.deleteSessionByHash.mockResolvedValue({ count: 0 })
      const app = await buildTestApp()
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        payload: { refreshToken: 'unknown' },
      })
      // No Authorization header attached, and the request still reached
      // the route handler — proves /auth/logout is in PUBLIC_ROUTES.
      expect(res.statusCode).toBe(204)
      await app.close()
    })
  })
})
