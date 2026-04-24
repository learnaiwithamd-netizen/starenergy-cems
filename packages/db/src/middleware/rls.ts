import type { UserRole } from '@cems/types'

export interface RlsContext {
  tenantId: string
  userId: string
  role: UserRole
}

// RLS middleware sets SESSION_CONTEXT before every Prisma query.
// Full implementation in Story 0.3 (Database Schema & RLS Foundation).
// Architecture mandate: every query goes through this — never bypass with $queryRaw without SESSION_CONTEXT set.
export function applyRlsMiddleware(_context: RlsContext): never {
  throw new Error(
    'applyRlsMiddleware is a scaffold stub. Row-Level Security wiring lands in Story 0.3. ' +
      'Do not call this until the real middleware ships — a silent no-op here would cross tenant boundaries.'
  )
}
