import { type Prisma, prisma, withRlsTransaction, type RlsContext } from '@cems/db'
import { UserRole } from '@cems/types'

/**
 * The auth flow has no caller-supplied tenant context until *after* user
 * lookup — we receive an email/password or a refresh token, and the tenant
 * is whatever tenant the resolved user belongs to. Plain Prisma calls would
 * see SESSION_CONTEXT('tenant_id') as empty and the RLS predicate
 * `WHERE @tenant_id = SESSION_CONTEXT('tenant_id') OR user_role = 'ADMIN'`
 * would fail-closed (0 rows).
 *
 * SYSTEM_AUTH_CONTEXT exploits the OR-ADMIN clause intentionally: by setting
 * user_role = 'ADMIN' we make the predicate return 1 regardless of
 * @tenant_id, which lets auth lookups see across all tenants. The sentinel
 * tenant_id `__auth_system__` is reserved and must never appear as a real
 * tenant id in any data row.
 *
 * Use ONLY in:
 *   - apps/api/src/services/auth.service.ts
 *   - apps/api/src/repositories/user.repo.ts
 *   - apps/api/src/repositories/user-session.repo.ts
 *
 * After the user is resolved, every subsequent operation on the same request
 * must use the user's ACTUAL tenant context — do not keep the system context
 * alive past user resolution. Future hardening: replace the OR-ADMIN clause
 * with a dedicated `is_system_auth` SESSION_CONTEXT key so role=ADMIN no
 * longer doubles as the auth-flow gate.
 */
export const SYSTEM_AUTH_CONTEXT: Readonly<RlsContext> = Object.freeze({
  tenantId: '__auth_system__',
  userId: '__auth_system__',
  role: UserRole.ADMIN,
  assignedStoreIds: Object.freeze([]) as readonly string[],
}) as RlsContext

/**
 * Run a unit of auth-flow work inside an RLS-pinned transaction with the
 * system-auth context active. Mirrors `request.withRls` but uses the
 * synthetic context above instead of pulling from `request.rlsContext`.
 */
export function withSystemAuth<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return withRlsTransaction(prisma, SYSTEM_AUTH_CONTEXT, fn)
}
