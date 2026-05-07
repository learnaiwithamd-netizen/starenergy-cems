import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { jwtVerify } from 'jose'
import {
  ACCESS_TOKEN_TTL_BY_ROLE,
  JWT_AUDIENCE,
  JWT_ISSUER,
  REFRESH_TOKEN_TTL_BY_ROLE,
  UserRole,
} from '@cems/types'
import {
  __resetJwtSecretCacheForTests,
  generateRefreshToken,
  getJwtSecret,
  hashRefreshToken,
  issueAccessToken,
} from './tokens.js'

const FAKE_JWT_SECRET = 'unit-test-secret-do-not-use-in-prod-min-32-chars-long'

describe('tokens', () => {
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

  describe('getJwtSecret', () => {
    it('throws when JWT_SECRET is unset', () => {
      delete process.env['JWT_SECRET']
      __resetJwtSecretCacheForTests()
      expect(() => getJwtSecret()).toThrow(/JWT_SECRET is not set/)
    })

    it('throws when JWT_SECRET is shorter than 32 chars', () => {
      process.env['JWT_SECRET'] = 'too-short'
      __resetJwtSecretCacheForTests()
      expect(() => getJwtSecret()).toThrow(/at least 32 characters/)
    })

    it('caches the encoded bytes across calls', () => {
      const a = getJwtSecret()
      const b = getJwtSecret()
      expect(a).toBe(b) // identity, not just equality — proves cache hit
    })
  })

  describe('issueAccessToken', () => {
    it.each([
      [UserRole.AUDITOR, 8 * 60 * 60],
      [UserRole.ADMIN, 4 * 60 * 60],
      [UserRole.CLIENT, 4 * 60 * 60],
    ])('signs an HS256 JWT with the role-specific TTL (role=%s)', async (role, expectedTtl) => {
      const before = Math.floor(Date.now() / 1000)
      const { token, expiresIn } = await issueAccessToken({
        id: 'user-1',
        tenantId: 'tenant-a',
        role,
        assignedStoreIds: ['store-1'],
      })
      const after = Math.floor(Date.now() / 1000)

      expect(expiresIn).toBe(expectedTtl)
      expect(ACCESS_TOKEN_TTL_BY_ROLE[role]).toBe(expectedTtl)

      const { payload, protectedHeader } = await jwtVerify(token, getJwtSecret(), {
        algorithms: ['HS256'],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      })

      expect(protectedHeader.alg).toBe('HS256')
      expect(payload.sub).toBe('user-1')
      expect(payload['tenantId']).toBe('tenant-a')
      expect(payload['role']).toBe(role)
      expect(payload['assignedStoreIds']).toEqual(['store-1'])
      expect(payload.iss).toBe(JWT_ISSUER)
      expect(payload.aud).toBe(JWT_AUDIENCE)
      expect(typeof payload.exp).toBe('number')
      expect(payload.exp).toBeGreaterThanOrEqual(before + expectedTtl)
      expect(payload.exp).toBeLessThanOrEqual(after + expectedTtl + 1)
    })
  })

  describe('generateRefreshToken', () => {
    it.each([
      [UserRole.AUDITOR, 7 * 24 * 60 * 60],
      [UserRole.ADMIN, 1 * 24 * 60 * 60],
      [UserRole.CLIENT, 1 * 24 * 60 * 60],
    ])('produces a base64url 64-byte token with role-specific TTL (role=%s)', (role, expectedTtl) => {
      const before = Date.now()
      const { token, hash, expiresAt } = generateRefreshToken(role)
      const after = Date.now()

      expect(REFRESH_TOKEN_TTL_BY_ROLE[role]).toBe(expectedTtl)

      // base64url charset only — no +, /, =
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
      // 64 bytes → ceil(64/3)*4 = 88 base64 chars; base64url drops padding.
      // Decoded length must be exactly 64.
      const decoded = Buffer.from(token, 'base64url')
      expect(decoded.length).toBe(64)

      // Hash is 64 hex chars (sha256).
      expect(hash).toMatch(/^[0-9a-f]{64}$/)

      // Expiry within ±1s of the expected window.
      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + expectedTtl * 1000 - 1000)
      expect(expiresAt.getTime()).toBeLessThanOrEqual(after + expectedTtl * 1000 + 1000)
    })

    it('produces unique tokens across successive calls', () => {
      const a = generateRefreshToken(UserRole.AUDITOR)
      const b = generateRefreshToken(UserRole.AUDITOR)
      expect(a.token).not.toBe(b.token)
      expect(a.hash).not.toBe(b.hash)
    })
  })

  describe('hashRefreshToken', () => {
    it('is deterministic — same input produces same hash', () => {
      expect(hashRefreshToken('abc')).toBe(hashRefreshToken('abc'))
    })

    it('changes on a single-character change in the input (avalanche)', () => {
      expect(hashRefreshToken('abc')).not.toBe(hashRefreshToken('abd'))
    })

    it('matches the hash returned by generateRefreshToken (round-trip)', () => {
      const { token, hash } = generateRefreshToken(UserRole.ADMIN)
      expect(hashRefreshToken(token)).toBe(hash)
    })

    it('produces a 64-char hex string (sha256)', () => {
      expect(hashRefreshToken('whatever')).toMatch(/^[0-9a-f]{64}$/)
    })
  })
})
