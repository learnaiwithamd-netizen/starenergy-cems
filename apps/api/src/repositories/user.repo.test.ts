import { describe, it, expect, vi } from 'vitest'
import { findActiveUserByEmail, findActiveUserById } from './user.repo.js'
import { UserRole } from '@cems/types'

type AnyArg = Record<string, unknown>

const baseRow = {
  id: 'user-1',
  tenantId: 'tenant-a',
  email: 'auditor@cems.local',
  role: 'AUDITOR',
  passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$abc$def',
  assignedStoreIds: '["store-1","store-2"]',
}

describe('user.repo', () => {
  describe('findActiveUserByEmail', () => {
    it('selects by email and parses assignedStoreIds JSON', async () => {
      const findFirst = vi.fn<(arg: AnyArg) => Promise<typeof baseRow>>(async () => baseRow)
      const tx = { user: { findFirst } }

      const user = await findActiveUserByEmail(tx, 'auditor@cems.local')

      expect(user).toEqual({
        id: 'user-1',
        tenantId: 'tenant-a',
        email: 'auditor@cems.local',
        role: UserRole.AUDITOR,
        passwordHash: baseRow.passwordHash,
        assignedStoreIds: ['store-1', 'store-2'],
      })
      const arg = findFirst.mock.calls[0]![0]
      expect(arg['where']).toEqual({ email: 'auditor@cems.local' })
      expect(arg['select']).toMatchObject({
        id: true,
        tenantId: true,
        email: true,
        role: true,
        passwordHash: true,
        assignedStoreIds: true,
      })
    })

    it('returns null when no user matches', async () => {
      const tx = { user: { findFirst: vi.fn(async () => null) } }
      expect(await findActiveUserByEmail(tx, 'nobody@cems.local')).toBeNull()
    })

    it('coerces malformed assignedStoreIds JSON to [] (defence-in-depth)', async () => {
      const tx = {
        user: { findFirst: vi.fn(async () => ({ ...baseRow, assignedStoreIds: 'not-json' })) },
      }
      const user = await findActiveUserByEmail(tx, 'x@y.z')
      expect(user?.assignedStoreIds).toEqual([])
    })

    it('drops empty-string and non-string entries from assignedStoreIds', async () => {
      const tx = {
        user: {
          findFirst: vi.fn(async () => ({
            ...baseRow,
            assignedStoreIds: JSON.stringify(['', 42, 'store-a']),
          })),
        },
      }
      const user = await findActiveUserByEmail(tx, 'x@y.z')
      expect(user?.assignedStoreIds).toEqual(['store-a'])
    })
  })

  describe('findActiveUserById', () => {
    it('selects by id', async () => {
      const findFirst = vi.fn<(arg: AnyArg) => Promise<typeof baseRow>>(async () => baseRow)
      const tx = { user: { findFirst } }

      await findActiveUserById(tx, 'user-1')

      const arg = findFirst.mock.calls[0]![0]
      expect(arg['where']).toEqual({ id: 'user-1' })
    })
  })
})
