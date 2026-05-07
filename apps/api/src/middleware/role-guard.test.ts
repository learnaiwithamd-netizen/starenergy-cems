import { describe, it, expect } from 'vitest'
import type { FastifyRequest } from 'fastify'
import { UserRole } from '@cems/types'
import { requireRole } from './role-guard.js'
import { RoleNotPermittedError } from '../lib/auth-errors.js'

function fakeRequest(role: UserRole | null): FastifyRequest {
  return {
    rlsContext:
      role === null
        ? null
        : {
            tenantId: 'tenant-a',
            userId: 'user-1',
            role,
            assignedStoreIds: [],
          },
  } as unknown as FastifyRequest
}

describe('requireRole', () => {
  it('allows a request whose role is in the allowlist', async () => {
    const guard = requireRole([UserRole.ADMIN])
    await expect(guard(fakeRequest(UserRole.ADMIN))).resolves.toBeUndefined()
  })

  it('rejects a request whose role is NOT in the allowlist', async () => {
    const guard = requireRole([UserRole.ADMIN])
    await expect(guard(fakeRequest(UserRole.AUDITOR))).rejects.toBeInstanceOf(
      RoleNotPermittedError,
    )
    await expect(guard(fakeRequest(UserRole.CLIENT))).rejects.toBeInstanceOf(
      RoleNotPermittedError,
    )
  })

  it('supports a multi-role allowlist', async () => {
    const guard = requireRole([UserRole.ADMIN, UserRole.AUDITOR])
    await expect(guard(fakeRequest(UserRole.ADMIN))).resolves.toBeUndefined()
    await expect(guard(fakeRequest(UserRole.AUDITOR))).resolves.toBeUndefined()
    await expect(guard(fakeRequest(UserRole.CLIENT))).rejects.toBeInstanceOf(
      RoleNotPermittedError,
    )
  })

  it('throws RoleNotPermittedError when rlsContext is null (defensive)', async () => {
    const guard = requireRole([UserRole.ADMIN])
    await expect(guard(fakeRequest(null))).rejects.toBeInstanceOf(RoleNotPermittedError)
  })

  it('throws synchronously at factory-time if no roles are passed', () => {
    expect(() => requireRole([])).toThrow(/at least one role/i)
  })
})
