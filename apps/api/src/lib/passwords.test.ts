import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword, getDummyPasswordHash } from './passwords.js'

describe('passwords', () => {
  describe('hashPassword + verifyPassword', () => {
    it('round-trips a password', async () => {
      const hash = await hashPassword('correct horse battery staple')
      expect(hash.startsWith('$argon2id$')).toBe(true)
      expect(await verifyPassword(hash, 'correct horse battery staple')).toBe(true)
    })

    it('rejects the wrong password', async () => {
      const hash = await hashPassword('correct horse battery staple')
      expect(await verifyPassword(hash, 'almost the right one')).toBe(false)
    })

    it('returns false (does not throw) on a malformed hash', async () => {
      expect(await verifyPassword('not-an-argon2-hash', 'whatever')).toBe(false)
    })

    it('returns false (does not throw) on empty hash', async () => {
      expect(await verifyPassword('', 'whatever')).toBe(false)
    })

    it('produces different hashes for the same plaintext (per-hash salt)', async () => {
      const a = await hashPassword('hunter2')
      const b = await hashPassword('hunter2')
      expect(a).not.toBe(b)
      expect(await verifyPassword(a, 'hunter2')).toBe(true)
      expect(await verifyPassword(b, 'hunter2')).toBe(true)
    })
  })

  describe('getDummyPasswordHash', () => {
    it('returns a valid argon2id hash', async () => {
      const hash = await getDummyPasswordHash()
      expect(hash.startsWith('$argon2id$')).toBe(true)
    })

    it('caches across calls (same Promise resolved value)', async () => {
      const a = await getDummyPasswordHash()
      const b = await getDummyPasswordHash()
      expect(a).toBe(b)
    })

    it('does not verify against any guessable plaintext', async () => {
      const hash = await getDummyPasswordHash()
      // Random 32-byte plaintext means an attacker cannot construct one.
      expect(await verifyPassword(hash, '')).toBe(false)
      expect(await verifyPassword(hash, 'password')).toBe(false)
      expect(await verifyPassword(hash, 'admin')).toBe(false)
    })
  })
})
