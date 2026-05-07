import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'

const { serviceMock } = vi.hoisted(() => ({
  serviceMock: {
    validateToken: vi.fn(),
    setPassword: vi.fn(),
  },
}))
vi.mock('../services/password-set.service.js', () => serviceMock)

import { __resetJwtSecretCacheForTests } from '../lib/tokens.js'
import { buildErrorHandler } from '../middleware/error-handler.js'
import { registerAuthHook } from '../middleware/auth.js'
import { registerPasswordSetRoutes } from './password-set.routes.js'
import { InvalidCredentialsError } from '../lib/auth-errors.js'

const FAKE_JWT_SECRET = 'unit-test-secret-do-not-use-in-prod-min-32-chars-long'

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(sensible)
  app.setErrorHandler(buildErrorHandler())
  registerAuthHook(app)
  registerPasswordSetRoutes(app)
  return app
}

describe('password-set.routes', () => {
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

  describe('GET /api/v1/auth/password-set/validate', () => {
    it('200 returns email when the token is valid', async () => {
      serviceMock.validateToken.mockResolvedValue({ email: 'auditor@cems.local' })
      const app = await buildTestApp()
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/password-set/validate?token=plain',
      })
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body)).toEqual({ valid: true, email: 'auditor@cems.local' })
      await app.close()
    })

    it('404 when the token is unknown / used / expired', async () => {
      serviceMock.validateToken.mockResolvedValue(null)
      const app = await buildTestApp()
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/password-set/validate?token=unknown',
      })
      expect(res.statusCode).toBe(404)
      const body = JSON.parse(res.body)
      expect(body.detail).toBe('Invalid or expired link')
      await app.close()
    })

    it('does NOT require an Authorization header (public route)', async () => {
      serviceMock.validateToken.mockResolvedValue(null)
      const app = await buildTestApp()
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/password-set/validate?token=anything',
      })
      // 404 from the service, NOT 401 from the auth hook.
      expect(res.statusCode).toBe(404)
      await app.close()
    })
  })

  describe('POST /api/v1/auth/password-set', () => {
    it('204 on successful password set', async () => {
      serviceMock.setPassword.mockResolvedValue(undefined)
      const app = await buildTestApp()
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/password-set',
        payload: { token: 'plain', password: 'a-strong-password-that-is-long-enough' },
      })
      expect(res.statusCode).toBe(204)
      await app.close()
    })

    it('401 on invalid token (service throws InvalidCredentialsError)', async () => {
      serviceMock.setPassword.mockRejectedValue(new InvalidCredentialsError('Invalid or expired link'))
      const app = await buildTestApp()
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/password-set',
        payload: { token: 'unknown', password: 'a-strong-password-that-is-long-enough' },
      })
      expect(res.statusCode).toBe(401)
      const body = JSON.parse(res.body)
      // InvalidCredentialsError is mapped to the generic 'Invalid email or password'
      // detail by the global handler. The detail is intentionally generic so the
      // password-set form behaves exactly like the login form on bad input.
      expect(body.detail).toBe('Invalid email or password')
      await app.close()
    })

    it('422 when the password is too short', async () => {
      const app = await buildTestApp()
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/password-set',
        payload: { token: 'plain', password: 'short' },
      })
      expect(res.statusCode).toBe(422)
      await app.close()
    })

    it('does NOT require an Authorization header (public route)', async () => {
      serviceMock.setPassword.mockResolvedValue(undefined)
      const app = await buildTestApp()
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/password-set',
        payload: { token: 'plain', password: 'a-strong-password-that-is-long-enough' },
      })
      expect(res.statusCode).toBe(204)
      await app.close()
    })
  })
})
