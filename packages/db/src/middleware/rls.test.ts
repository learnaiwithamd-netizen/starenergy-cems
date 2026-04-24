import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { withRlsContext, RlsContextError } from './rls.js'
import { UserRole } from '@cems/types'

describe('withRlsContext — validation', () => {
  const stubPrisma = {
    $extends: (_config: unknown) => ({ extended: true }),
    $executeRaw: vi.fn(),
  } as unknown as PrismaClient

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

  it('throws when assignedStoreIds contains an empty string (bypass-prevention)', () => {
    expect(() =>
      withRlsContext(stubPrisma, {
        tenantId: 't',
        userId: 'u',
        role: UserRole.CLIENT,
        assignedStoreIds: [''],
      }),
    ).toThrow(RlsContextError)
  })
})

/**
 * AC 2 verification: `withRlsContext` runs four `sp_set_session_context` EXECs in a fixed
 * order before every model operation. Captures the `$allOperations` interceptor via a stub
 * `$extends`, then asserts the exact `$executeRaw` tagged-template call sequence + values.
 */
describe('withRlsContext — AC 2 sp_set_session_context sequence', () => {
  type AllOperationsArgs = { args: unknown; query: (a: unknown) => Promise<string> }
  type CapturedExtension = {
    query: {
      $allModels: {
        $allOperations: (args: AllOperationsArgs) => Promise<string>
      }
    }
  }

  function makeSpyPrisma() {
    const execs: Array<{ strings: readonly string[]; values: unknown[] }> = []
    let captured: CapturedExtension | undefined

    const stub = {
      $extends(config: CapturedExtension) {
        captured = config
        return {}
      },
      async $executeRaw(strings: TemplateStringsArray, ...values: unknown[]) {
        execs.push({ strings: [...strings], values })
        return 1
      },
    } as unknown as PrismaClient

    return { stub, execs, getCaptured: () => captured }
  }

  it('runs tenant_id → user_id → user_role → assigned_store_ids EXECs in order, then query', async () => {
    const { stub, execs, getCaptured } = makeSpyPrisma()

    withRlsContext(stub, {
      tenantId: 'tenant-a',
      userId: 'user-1',
      role: UserRole.AUDITOR,
      assignedStoreIds: ['store-alpha', 'store-beta'],
    })

    const captured = getCaptured()
    expect(captured).toBeDefined()

    const queryFn = vi.fn(async (_args: unknown) => 'query-result')
    const result = await captured!.query.$allModels.$allOperations({
      args: { where: { id: 'x' } },
      query: queryFn,
    })

    expect(execs).toHaveLength(4)

    const joinedStrings = execs.map((e) => e.strings.join(''))
    expect(joinedStrings[0]).toContain("N'tenant_id'")
    expect(joinedStrings[0]).toContain('@read_only = 0')
    expect(joinedStrings[1]).toContain("N'user_id'")
    expect(joinedStrings[1]).toContain('@read_only = 0')
    expect(joinedStrings[2]).toContain("N'user_role'")
    expect(joinedStrings[2]).toContain('@read_only = 0')
    expect(joinedStrings[3]).toContain("N'assigned_store_ids'")
    expect(joinedStrings[3]).toContain('@read_only = 0')

    expect(execs[0]!.values).toEqual(['tenant-a'])
    expect(execs[1]!.values).toEqual(['user-1'])
    expect(execs[2]!.values).toEqual([UserRole.AUDITOR])
    expect(execs[3]!.values).toEqual([JSON.stringify(['store-alpha', 'store-beta'])])

    expect(queryFn).toHaveBeenCalledOnce()
    expect(result).toBe('query-result')
  })

  it('serializes assignedStoreIds as an empty JSON array when omitted', async () => {
    const { stub, execs, getCaptured } = makeSpyPrisma()
    withRlsContext(stub, { tenantId: 't', userId: 'u', role: UserRole.ADMIN })
    await getCaptured()!.query.$allModels.$allOperations({ args: {}, query: async () => 'ok' })
    expect(execs[3]!.values).toEqual(['[]'])
  })
})
