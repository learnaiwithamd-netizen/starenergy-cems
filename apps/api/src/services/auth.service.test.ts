import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { jwtVerify } from 'jose'
import { JWT_AUDIENCE, JWT_ISSUER, UserRole } from '@cems/types'

// ─── Module mocks (vi.hoisted lets us reference symbols inside vi.mock factory) ─
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

// ─── SUT + collaborators (real argon2, real JWT) ───────────────────────

import { hashPassword } from '../lib/passwords.js'
import { __resetJwtSecretCacheForTests, getJwtSecret, hashRefreshToken } from '../lib/tokens.js'
import { InvalidCredentialsError } from '../lib/auth-errors.js'
import { login, logout, refresh } from './auth.service.js'

const FAKE_JWT_SECRET = 'unit-test-secret-do-not-use-in-prod-min-32-chars-long'

const seededUser = {
  id: 'user-1',
  tenantId: 'tenant-a',
  email: 'auditor@cems.local',
  role: UserRole.AUDITOR,
  passwordHash: '', // populated in beforeAll
  assignedStoreIds: ['store-1'],
}

describe('auth.service', () => {
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

  // ─── login ────────────────────────────────────────────────────────────

  describe('login', () => {
    it('returns a valid token pair on correct credentials', async () => {
      userRepoMock.findActiveUserByEmail.mockResolvedValue(seededUser)
      sessionRepoMock.createSession.mockResolvedValue({ id: 'sess-1' })

      const res = await login({ email: 'auditor@cems.local', password: 'correct-password' })

      expect(res.tokenType).toBe('Bearer')
      expect(res.expiresIn).toBe(8 * 60 * 60)
      expect(res.refreshToken.length).toBeGreaterThan(40) // base64url(64 bytes) ~ 86 chars

      // Access token decodes and carries the right claims.
      const { payload } = await jwtVerify(res.accessToken, getJwtSecret(), {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      })
      expect(payload.sub).toBe('user-1')
      expect(payload['tenantId']).toBe('tenant-a')
      expect(payload['role']).toBe(UserRole.AUDITOR)
      expect(payload['assignedStoreIds']).toEqual(['store-1'])

      // Session row inserted with the SHA-256 hash of the refresh token.
      expect(sessionRepoMock.createSession).toHaveBeenCalledOnce()
      const sessionArg = sessionRepoMock.createSession.mock.calls[0]![1]
      expect(sessionArg).toMatchObject({
        tenantId: 'tenant-a',
        userId: 'user-1',
        refreshTokenHash: hashRefreshToken(res.refreshToken),
      })
      expect(sessionArg.expiresAt).toBeInstanceOf(Date)
      expect(sessionArg.expiresAt.getTime()).toBeGreaterThan(Date.now())
    })

    it('throws InvalidCredentialsError on wrong password', async () => {
      userRepoMock.findActiveUserByEmail.mockResolvedValue(seededUser)
      await expect(
        login({ email: 'auditor@cems.local', password: 'WRONG' }),
      ).rejects.toBeInstanceOf(InvalidCredentialsError)
      expect(sessionRepoMock.createSession).not.toHaveBeenCalled()
    })

    it('throws InvalidCredentialsError on unknown email AND consumes argon2 verify time', async () => {
      userRepoMock.findActiveUserByEmail.mockResolvedValue(null)

      const start = Date.now()
      await expect(
        login({ email: 'nobody@cems.local', password: 'WRONG' }),
      ).rejects.toBeInstanceOf(InvalidCredentialsError)
      const elapsed = Date.now() - start

      // Dummy argon2.verify takes ~30ms on the configured cost; assert
      // unknown-email path is at least 5ms (defends against the
      // "skip the dummy verify" regression).
      expect(elapsed).toBeGreaterThanOrEqual(5)
      expect(sessionRepoMock.createSession).not.toHaveBeenCalled()
    })
  })

  // ─── refresh ──────────────────────────────────────────────────────────

  describe('refresh', () => {
    it('rotates the refresh token: deletes old, creates new, issues fresh access', async () => {
      const oldRefreshToken = 'old-refresh-token-plaintext'
      const oldHash = hashRefreshToken(oldRefreshToken)

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

      const res = await refresh({ refreshToken: oldRefreshToken })

      expect(res.accessToken).toBeDefined()
      expect(res.refreshToken).toBeDefined()
      expect(res.refreshToken).not.toBe(oldRefreshToken)

      // Old hash deleted before new session created (call order).
      const deleteCallOrder = sessionRepoMock.deleteSessionByHash.mock.invocationCallOrder[0]
      const createCallOrder = sessionRepoMock.createSession.mock.invocationCallOrder[0]
      expect(deleteCallOrder).toBeLessThan(createCallOrder!)

      expect(sessionRepoMock.deleteSessionByHash).toHaveBeenCalledWith(fakeTx, oldHash)
      const newSessionArg = sessionRepoMock.createSession.mock.calls[0]![1]
      expect(newSessionArg.refreshTokenHash).toBe(hashRefreshToken(res.refreshToken))
    })

    it('rejects an unknown refresh token with InvalidCredentialsError', async () => {
      sessionRepoMock.findActiveSessionByHash.mockResolvedValue(null)
      await expect(refresh({ refreshToken: 'not-a-known-token' })).rejects.toBeInstanceOf(
        InvalidCredentialsError,
      )
      expect(sessionRepoMock.deleteSessionByHash).not.toHaveBeenCalled()
      expect(sessionRepoMock.createSession).not.toHaveBeenCalled()
    })

    it('rejects when the session points at a missing user (orphan)', async () => {
      sessionRepoMock.findActiveSessionByHash.mockResolvedValue({
        id: 'sess-old',
        tenantId: 'tenant-a',
        userId: 'user-deleted',
        refreshTokenHash: 'whatever',
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
      })
      userRepoMock.findActiveUserById.mockResolvedValue(null)

      await expect(refresh({ refreshToken: 'orphan-token' })).rejects.toBeInstanceOf(
        InvalidCredentialsError,
      )
    })
  })

  // ─── logout ───────────────────────────────────────────────────────────

  describe('logout', () => {
    it('hashes the supplied token and deletes the matching session', async () => {
      sessionRepoMock.deleteSessionByHash.mockResolvedValue({ count: 1 })

      await logout({ refreshToken: 'some-refresh' })

      expect(sessionRepoMock.deleteSessionByHash).toHaveBeenCalledWith(
        fakeTx,
        hashRefreshToken('some-refresh'),
      )
    })

    it('is a no-op (no throw) when the token is unknown', async () => {
      sessionRepoMock.deleteSessionByHash.mockResolvedValue({ count: 0 })
      await expect(logout({ refreshToken: 'unknown-token' })).resolves.toBeUndefined()
    })
  })
})
