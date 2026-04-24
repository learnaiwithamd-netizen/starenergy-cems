import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { UserRole } from '@cems/types'

/**
 * RLS context — set on every Prisma query via sp_set_session_context.
 * Azure SQL RLS policies filter rows based on these session variables.
 */
const rlsContextSchema = z.object({
  tenantId: z.string().min(1),
  userId: z.string().min(1),
  role: z.nativeEnum(UserRole),
  assignedStoreIds: z.array(z.string().min(1)).optional(),
})

export type RlsContext = z.infer<typeof rlsContextSchema>

export class RlsContextError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RlsContextError'
  }
}

/**
 * Wrap a PrismaClient with an extension that sets SESSION_CONTEXT before every model query.
 *
 * Set BEFORE every query (not once per request) because Prisma's connection pool may return
 * a different connection between queries, and SESSION_CONTEXT is per-connection.
 *
 * ⚠️ LIMITATION (deferred to Story 0.4):
 * - The extension hooks only `$allModels.$allOperations`. Raw `$queryRaw` / `$executeRaw` calls
 *   BYPASS the middleware and run with whatever SESSION_CONTEXT happens to be on the pooled
 *   connection. Do NOT use raw queries on tenant-scoped tables until Story 0.4 wraps per-request
 *   execution in an interactive `$transaction` so the connection is pinned.
 * - The 4 `sp_set_session_context` EXECs + the actual query each acquire a connection from the
 *   pool independently. Under concurrency, SESSION_CONTEXT may land on connection A while the
 *   query runs on connection B. Story 0.4 addresses this with `withRlsTransaction(ctx, fn)`.
 *

 * Hardening NOT applied: `@read_only = 0` on tenant_id/user_id/user_role would prevent a
 * subsequent SQL-injection attempt from resetting user_role to ADMIN — BUT it also prevents
 * the middleware itself from re-setting the context on the NEXT query when the pool returns
 * the same connection to a different caller (second `sp_set_session_context` fails with
 * "key has been set as read_only"). The clean fix is per-request connection-affinity via
 * Story 0.4's `withRlsTransaction`. Until then, `@read_only = 0` is the correct trade-off.
 */
export function withRlsContext<T extends PrismaClient>(prisma: T, context: RlsContext) {
  const validated = rlsContextSchema.safeParse(context)
  if (!validated.success) {
    throw new RlsContextError(
      `Invalid RlsContext: ${validated.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
    )
  }

  const ctx = validated.data
  const assignedStoreIdsJson = JSON.stringify(ctx.assignedStoreIds ?? [])

  return prisma.$extends({
    name: 'rls-context',
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          await prisma.$executeRaw`EXEC sp_set_session_context @key = N'tenant_id', @value = ${ctx.tenantId}, @read_only = 0`
          await prisma.$executeRaw`EXEC sp_set_session_context @key = N'user_id', @value = ${ctx.userId}, @read_only = 0`
          await prisma.$executeRaw`EXEC sp_set_session_context @key = N'user_role', @value = ${ctx.role}, @read_only = 0`
          await prisma.$executeRaw`EXEC sp_set_session_context @key = N'assigned_store_ids', @value = ${assignedStoreIdsJson}, @read_only = 0`
          return query(args)
        },
      },
    },
  })
}
