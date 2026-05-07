// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaLike = any

export interface CreateSessionInput {
  tenantId: string
  userId: string
  refreshTokenHash: string
  expiresAt: Date
}

export interface SessionRow {
  id: string
  tenantId: string
  userId: string
  refreshTokenHash: string
  expiresAt: Date
  revokedAt: Date | null
}

/**
 * Insert a new user_sessions row. Caller passes the tx returned by
 * `withSystemAuth(...)` so RLS is satisfied via the OR-ADMIN bypass.
 */
export async function createSession(tx: PrismaLike, input: CreateSessionInput): Promise<{ id: string }> {
  const row = await tx.userSession.create({
    data: {
      tenantId: input.tenantId,
      userId: input.userId,
      refreshTokenHash: input.refreshTokenHash,
      expiresAt: input.expiresAt,
    },
    select: { id: true },
  })
  return { id: row.id }
}

/**
 * Look up the active (not revoked, not expired) session matching this
 * refresh-token hash. Caller passes the tx; returns null if not found.
 */
export async function findActiveSessionByHash(
  tx: PrismaLike,
  refreshTokenHash: string,
): Promise<SessionRow | null> {
  const row = await tx.userSession.findFirst({
    where: {
      refreshTokenHash,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      tenantId: true,
      userId: true,
      refreshTokenHash: true,
      expiresAt: true,
      revokedAt: true,
    },
  })
  return row as SessionRow | null
}

/**
 * Idempotent delete-by-hash. Returns the number of rows actually removed
 * (0 if the hash was unknown). Logout endpoint always responds 204
 * regardless of this count to avoid leaking whether the token existed.
 */
export async function deleteSessionByHash(
  tx: PrismaLike,
  refreshTokenHash: string,
): Promise<{ count: number }> {
  const res = await tx.userSession.deleteMany({ where: { refreshTokenHash } })
  return { count: res.count }
}

/**
 * Revoke every session for a user. Used by the deactivation path
 * (Story 1.3 AC3). Caller MUST pass the same `tx` it uses to set
 * status=INACTIVE so both happen atomically.
 */
export async function deleteSessionsByUserId(
  tx: PrismaLike,
  userId: string,
): Promise<{ count: number }> {
  const res = await tx.userSession.deleteMany({ where: { userId } })
  return { count: res.count }
}
