import type { FastifyRequest } from 'fastify'
import type { UserRole } from '@cems/types'
import { RoleNotPermittedError } from '../lib/auth-errors.js'

/**
 * Per-route Fastify pre-handler factory. Attach to a route's `preHandler`
 * to require the authenticated caller's `rlsContext.role` to be in the
 * allowlist. The auth hook MUST run first (it populates rlsContext).
 *
 *   app.get('/api/v1/admin/users', {
 *     preHandler: requireRole([UserRole.ADMIN]),
 *   }, handler)
 *
 * Allowlist semantics: ANY role in the array is sufficient. Empty array is
 * a programming error (would deny everything) — caller's responsibility to
 * pass at least one role.
 *
 * Failure modes:
 *   - rlsContext is null (auth hook didn't run, e.g., a public route was
 *     mistakenly given this guard): 403 RoleNotPermittedError. Defensive —
 *     should never happen in practice.
 *   - Caller's role is not in the allowlist: 403 RoleNotPermittedError.
 */
export function requireRole(roles: readonly UserRole[]) {
  if (roles.length === 0) {
    throw new Error('requireRole: at least one role must be specified')
  }
  // Capture into a Set for O(1) lookup; freeze input semantics with `as const`-style copy.
  const allow = new Set(roles)
  return async function rolePreHandler(request: FastifyRequest): Promise<void> {
    const ctx = request.rlsContext
    if (!ctx || !allow.has(ctx.role)) {
      throw new RoleNotPermittedError()
    }
  }
}
