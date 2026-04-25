import { Prisma, PrismaClient } from '@prisma/client'
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

function validate(context: RlsContext): RlsContext {
  const result = rlsContextSchema.safeParse(context)
  if (!result.success) {
    throw new RlsContextError(
      `Invalid RlsContext: ${result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
    )
  }
  return result.data
}

async function applySessionContext(
  client: { $executeRaw: PrismaClient['$executeRaw'] },
  ctx: RlsContext,
): Promise<void> {
  const assignedStoreIdsJson = JSON.stringify(ctx.assignedStoreIds ?? [])
  await client.$executeRaw`EXEC sp_set_session_context @key = N'tenant_id', @value = ${ctx.tenantId}, @read_only = 0`
  await client.$executeRaw`EXEC sp_set_session_context @key = N'user_id', @value = ${ctx.userId}, @read_only = 0`
  await client.$executeRaw`EXEC sp_set_session_context @key = N'user_role', @value = ${ctx.role}, @read_only = 0`
  await client.$executeRaw`EXEC sp_set_session_context @key = N'assigned_store_ids', @value = ${assignedStoreIdsJson}, @read_only = 0`
}

/**
 * RECOMMENDED: run a unit of tenant-scoped work inside a Prisma interactive transaction
 * with SESSION_CONTEXT pinned to the same connection.
 *
 * - All four `sp_set_session_context` calls and every operation inside `fn` execute on
 *   the SAME pooled connection (Prisma's interactive transaction pins the connection
 *   for the lifetime of the callback).
 * - `tx.$queryRaw` / `tx.$executeRaw` inside `fn` are SAFE — they share the
 *   SESSION_CONTEXT set just before the callback runs.
 * - Nested model operations also inherit the context (no per-op middleware needed).
 *
 * This is the production pattern for handling a request. Use this instead of
 * `withRlsContext` for any code that touches tenant-scoped tables.
 *
 * Closes Story 0.3 review findings:
 *   - Raw-query bypass (`$queryRaw` / `$executeRaw` skip the model-level middleware)
 *   - Pool-interleaving race (4 EXECs + query may land on different pool connections)
 *   - `$transaction` batch form skipping the model-level middleware
 */
export async function withRlsTransaction<T>(
  prisma: PrismaClient,
  context: RlsContext,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: { timeout?: number; maxWait?: number },
): Promise<T> {
  const ctx = validate(context)
  return prisma.$transaction(
    async (tx) => {
      await applySessionContext(tx, ctx)
      return fn(tx)
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      timeout: options?.timeout ?? 10_000,
      maxWait: options?.maxWait ?? 5_000,
    },
  )
}

/**
 * @deprecated for tenant-scoped data access — use {@link withRlsTransaction} instead.
 *
 * Wraps a PrismaClient with an extension that sets SESSION_CONTEXT before every model query.
 * Each query's 4 `sp_set_session_context` EXECs + the query itself may land on different
 * pool connections. Use only for non-tenant-scoped operations or transitional code.
 */
export function withRlsContext<T extends PrismaClient>(prisma: T, context: RlsContext) {
  const ctx = validate(context)
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
