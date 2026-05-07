import { describe, it, expect, vi } from 'vitest'
import {
  createPasswordSetToken,
  findActiveToken,
  markTokenUsed,
} from './password-set-token.repo.js'

type AnyArg = Record<string, unknown>

describe('password-set-token.repo', () => {
  describe('createPasswordSetToken', () => {
    it('inserts a row with the supplied fields', async () => {
      const create = vi.fn<(arg: AnyArg) => Promise<{ id: string }>>(async () => ({ id: 't-1' }))
      const tx = { passwordSetToken: { create } }
      const expiresAt = new Date('2026-06-01T00:00:00Z')

      const res = await createPasswordSetToken(tx, {
        tenantId: 'tenant-a',
        userId: 'user-1',
        tokenHash: 'a'.repeat(64),
        expiresAt,
      })

      expect(res).toEqual({ id: 't-1' })
      const arg = create.mock.calls[0]![0]
      expect(arg['data']).toEqual({
        tenantId: 'tenant-a',
        userId: 'user-1',
        tokenHash: 'a'.repeat(64),
        expiresAt,
      })
    })
  })

  describe('findActiveToken', () => {
    it('returns the user info for an active token', async () => {
      const findFirst = vi.fn<(arg: AnyArg) => Promise<unknown>>(async () => ({
        tokenHash: 'a'.repeat(64),
        tenantId: 'tenant-a',
        userId: 'user-1',
        user: { email: 'auditor@cems.local' },
      }))
      const tx = { passwordSetToken: { findFirst } }

      const res = await findActiveToken(tx, 'a'.repeat(64))

      expect(res).toEqual({
        tenantId: 'tenant-a',
        userId: 'user-1',
        email: 'auditor@cems.local',
        tokenHash: 'a'.repeat(64),
      })
      const arg = findFirst.mock.calls[0]![0]
      const where = arg['where'] as Record<string, unknown>
      expect(where['tokenHash']).toBe('a'.repeat(64))
      expect(where['usedAt']).toBeNull()
      expect(where['expiresAt']).toMatchObject({ gt: expect.any(Date) })
    })

    it('returns null when no active token matches', async () => {
      const tx = { passwordSetToken: { findFirst: vi.fn(async () => null) } }
      expect(await findActiveToken(tx, 'unknown')).toBeNull()
    })
  })

  describe('markTokenUsed', () => {
    it('issues updateMany scoped to (tokenHash, usedAt: null)', async () => {
      const updateMany = vi.fn<(arg: AnyArg) => Promise<{ count: number }>>(async () => ({
        count: 1,
      }))
      const tx = { passwordSetToken: { updateMany } }

      const res = await markTokenUsed(tx, 'a'.repeat(64))

      expect(res).toEqual({ count: 1 })
      const arg = updateMany.mock.calls[0]![0]
      expect(arg['where']).toEqual({ tokenHash: 'a'.repeat(64), usedAt: null })
      expect(arg['data']).toMatchObject({ usedAt: expect.any(Date) })
    })

    it('returns 0 when the token has already been used (concurrency)', async () => {
      const tx = { passwordSetToken: { updateMany: vi.fn(async () => ({ count: 0 })) } }
      const res = await markTokenUsed(tx, 'already-used')
      expect(res.count).toBe(0)
    })
  })
})
