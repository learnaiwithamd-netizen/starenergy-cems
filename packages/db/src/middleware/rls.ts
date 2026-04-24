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
  assignedStoreIds: z.array(z.string()).optional(),
})

export type RlsContext = z.infer<typeof rlsContextSchema>

export class RlsContextError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RlsContextError'
  }
}

/**
 * Wrap a PrismaClient with an extension that sets SESSION_CONTEXT before every query.
 *
 * Set BEFORE every query (not once per request) because Prisma's connection pool may return
 * a different connection between queries, and SESSION_CONTEXT is per-connection.
 *
 * Azure SQL RLS predicates in security.fn_tenant_predicate() read tenant_id, user_role,
 * and assigned_store_ids from SESSION_CONTEXT.
 *
 * Architecture mandate: every query goes through this. Bypassing with $queryRaw without
 * SESSION_CONTEXT set is a tenant-isolation escape. Don't do it.
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
