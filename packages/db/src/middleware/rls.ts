export interface RlsContext {
  tenantId: string
  userId: string
  role: string
}

// RLS middleware sets SESSION_CONTEXT before every Prisma query.
// Full implementation in Story 0.3 (Database Schema & RLS Foundation).
// Architecture mandate: every query goes through this — never bypass with $queryRaw without SESSION_CONTEXT set.
export function applyRlsMiddleware(_context: RlsContext): void {
  // TODO: Story 0.3 — implement prisma.$use() to call sp_set_session_context
}
