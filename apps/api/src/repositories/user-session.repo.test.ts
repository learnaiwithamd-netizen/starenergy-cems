import { describe, it, expect, vi } from 'vitest'
import {
  createSession,
  deleteSessionByHash,
  findActiveSessionByHash,
} from './user-session.repo.js'

type AnyArg = Record<string, unknown>

describe('user-session.repo', () => {
  describe('createSession', () => {
    it('inserts a row with the supplied fields and selects the id', async () => {
      const createSpy = vi.fn<(arg: AnyArg) => Promise<{ id: string }>>(async () => ({
        id: 'sess-1',
      }))
      const tx = { userSession: { create: createSpy } }
      const expiresAt = new Date('2026-06-01T00:00:00Z')

      const res = await createSession(tx, {
        tenantId: 'tenant-a',
        userId: 'user-1',
        refreshTokenHash: 'a'.repeat(64),
        expiresAt,
      })

      expect(res).toEqual({ id: 'sess-1' })
      expect(createSpy).toHaveBeenCalledOnce()
      const arg = createSpy.mock.calls[0]![0]
      expect(arg['data']).toEqual({
        tenantId: 'tenant-a',
        userId: 'user-1',
        refreshTokenHash: 'a'.repeat(64),
        expiresAt,
      })
      expect(arg['select']).toEqual({ id: true })
    })
  })

  describe('findActiveSessionByHash', () => {
    it('queries for matching hash + null revokedAt + future expiresAt', async () => {
      const findSpy = vi.fn<(arg: AnyArg) => Promise<unknown>>(async () => ({
        id: 'sess-1',
        tenantId: 'tenant-a',
        userId: 'user-1',
        refreshTokenHash: 'a'.repeat(64),
        expiresAt: new Date('2026-06-01T00:00:00Z'),
        revokedAt: null,
      }))
      const tx = { userSession: { findFirst: findSpy } }

      await findActiveSessionByHash(tx, 'a'.repeat(64))

      const arg = findSpy.mock.calls[0]![0]
      const where = arg['where'] as Record<string, unknown>
      expect(where['refreshTokenHash']).toBe('a'.repeat(64))
      expect(where['revokedAt']).toBeNull()
      expect(where['expiresAt']).toMatchObject({ gt: expect.any(Date) })
    })

    it('returns null when no matching session', async () => {
      const tx = { userSession: { findFirst: vi.fn(async () => null) } }
      expect(await findActiveSessionByHash(tx, 'unknown')).toBeNull()
    })
  })

  describe('deleteSessionByHash', () => {
    it('issues deleteMany scoped to the hash and returns the count', async () => {
      const deleteSpy = vi.fn<(arg: AnyArg) => Promise<{ count: number }>>(async () => ({
        count: 1,
      }))
      const tx = { userSession: { deleteMany: deleteSpy } }

      const res = await deleteSessionByHash(tx, 'a'.repeat(64))

      expect(res).toEqual({ count: 1 })
      expect(deleteSpy).toHaveBeenCalledOnce()
      const arg = deleteSpy.mock.calls[0]![0]
      expect(arg['where']).toEqual({ refreshTokenHash: 'a'.repeat(64) })
    })

    it('returns count: 0 (idempotent) when nothing matched', async () => {
      const tx = { userSession: { deleteMany: vi.fn(async () => ({ count: 0 })) } }
      const res = await deleteSessionByHash(tx, 'unknown-hash')
      expect(res).toEqual({ count: 0 })
    })
  })
})
