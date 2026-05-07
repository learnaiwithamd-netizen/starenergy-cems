import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { fakeTx, txUserUpdateSpy, repoMock } = vi.hoisted(() => {
  const update = vi.fn().mockResolvedValue({ id: 'user-1' })
  return {
    fakeTx: { user: { update } },
    txUserUpdateSpy: update,
    repoMock: { findActiveToken: vi.fn(), markTokenUsed: vi.fn() },
  }
})

vi.mock('../lib/system-auth-context.js', () => ({
  SYSTEM_AUTH_CONTEXT: { tenantId: '__auth_system__' },
  withSystemAuth: <T>(fn: (tx: unknown) => Promise<T>) => fn(fakeTx),
}))
vi.mock('../repositories/password-set-token.repo.js', () => repoMock)

import { setPassword, validateToken } from './password-set.service.js'
import { sha256Hex } from '../lib/tokens.js'
import { InvalidCredentialsError } from '../lib/auth-errors.js'

describe('password-set.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    txUserUpdateSpy.mockResolvedValue({ id: 'user-1' })
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('validateToken', () => {
    it('returns the user email for an active token', async () => {
      repoMock.findActiveToken.mockResolvedValue({
        userId: 'user-1',
        tenantId: 'tenant-a',
        email: 'auditor@cems.local',
        tokenHash: sha256Hex('plain'),
      })
      const res = await validateToken('plain')
      expect(res).toEqual({ email: 'auditor@cems.local' })
      expect(repoMock.findActiveToken).toHaveBeenCalledWith(fakeTx, sha256Hex('plain'))
    })

    it('returns null for an empty token', async () => {
      expect(await validateToken('')).toBeNull()
      expect(repoMock.findActiveToken).not.toHaveBeenCalled()
    })

    it('returns null for an unknown / used / expired token', async () => {
      repoMock.findActiveToken.mockResolvedValue(null)
      expect(await validateToken('whatever')).toBeNull()
    })
  })

  describe('setPassword', () => {
    it('happy path — looks up, marks used, updates passwordHash', async () => {
      repoMock.findActiveToken.mockResolvedValue({
        userId: 'user-1',
        tenantId: 'tenant-a',
        email: 'auditor@cems.local',
        tokenHash: sha256Hex('plain'),
      })
      repoMock.markTokenUsed.mockResolvedValue({ count: 1 })

      await expect(
        setPassword({ token: 'plain', password: 'a-strong-password-that-is-long-enough' }),
      ).resolves.toBeUndefined()

      // Order: findActiveToken → markTokenUsed → user.update
      const findOrder = repoMock.findActiveToken.mock.invocationCallOrder[0]
      const markOrder = repoMock.markTokenUsed.mock.invocationCallOrder[0]
      expect(findOrder).toBeLessThan(markOrder!)
    })

    it('throws InvalidCredentialsError on unknown / expired / used token', async () => {
      repoMock.findActiveToken.mockResolvedValue(null)
      await expect(
        setPassword({ token: 'unknown', password: 'a-strong-password-that-is-long-enough' }),
      ).rejects.toBeInstanceOf(InvalidCredentialsError)
    })

    it('throws InvalidCredentialsError when markTokenUsed loses the race (count=0)', async () => {
      repoMock.findActiveToken.mockResolvedValue({
        userId: 'user-1',
        tenantId: 'tenant-a',
        email: 'auditor@cems.local',
        tokenHash: sha256Hex('plain'),
      })
      repoMock.markTokenUsed.mockResolvedValue({ count: 0 })

      await expect(
        setPassword({ token: 'plain', password: 'a-strong-password-that-is-long-enough' }),
      ).rejects.toBeInstanceOf(InvalidCredentialsError)
    })
  })
})
