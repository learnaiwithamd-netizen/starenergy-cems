import { describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { withRlsContext, RlsContextError } from './rls.js'
import { UserRole } from '@cems/types'

// Stub with just enough surface for withRlsContext to call $extends without crashing.
// Full extension behavior (session_context side effects) is covered by the guarded
// integration test (RUN_INTEGRATION=1).
const stubPrisma = {
  $extends: (_config: unknown) => ({ extended: true }),
} as unknown as PrismaClient

describe('withRlsContext — validation', () => {
  it('throws RlsContextError when tenantId is empty', () => {
    expect(() =>
      withRlsContext(stubPrisma, { tenantId: '', userId: 'u', role: UserRole.AUDITOR }),
    ).toThrow(RlsContextError)
  })

  it('throws RlsContextError when userId is empty', () => {
    expect(() =>
      withRlsContext(stubPrisma, { tenantId: 't', userId: '', role: UserRole.AUDITOR }),
    ).toThrow(RlsContextError)
  })

  it('throws RlsContextError when role is not a UserRole enum value', () => {
    expect(() =>
      // @ts-expect-error deliberately bad input
      withRlsContext(stubPrisma, { tenantId: 't', userId: 'u', role: 'SUPER_ADMIN' }),
    ).toThrow(RlsContextError)
  })

  it('accepts all three UserRole values without throwing', () => {
    for (const role of [UserRole.ADMIN, UserRole.AUDITOR, UserRole.CLIENT]) {
      expect(() =>
        withRlsContext(stubPrisma, { tenantId: 't', userId: 'u', role }),
      ).not.toThrow()
    }
  })

  it('accepts empty assignedStoreIds array', () => {
    expect(() =>
      withRlsContext(stubPrisma, {
        tenantId: 't',
        userId: 'u',
        role: UserRole.CLIENT,
        assignedStoreIds: [],
      }),
    ).not.toThrow()
  })

  it('throws when assignedStoreIds contains a non-string', () => {
    expect(() =>
      // @ts-expect-error deliberately bad input
      withRlsContext(stubPrisma, { tenantId: 't', userId: 'u', role: UserRole.CLIENT, assignedStoreIds: [123] }),
    ).toThrow(RlsContextError)
  })
})
