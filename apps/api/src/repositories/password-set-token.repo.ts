// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaLike = any

export interface CreatePasswordSetTokenInput {
  tenantId: string
  userId: string
  tokenHash: string
  expiresAt: Date
}

export async function createPasswordSetToken(
  tx: PrismaLike,
  input: CreatePasswordSetTokenInput,
): Promise<{ id: string }> {
  const row = await tx.passwordSetToken.create({
    data: {
      tenantId: input.tenantId,
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
    },
    select: { id: true },
  })
  return { id: row.id }
}

export interface ActiveTokenLookup {
  userId: string
  tenantId: string
  email: string
  tokenHash: string
}

/**
 * Look up a token row by hash, joined with the user table to fetch the
 * user's email (for the validate endpoint's response). Filters out used
 * (`usedAt != null`) and expired (`expiresAt <= now`) tokens.
 */
export async function findActiveToken(
  tx: PrismaLike,
  tokenHash: string,
): Promise<ActiveTokenLookup | null> {
  const row = await tx.passwordSetToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: {
      tokenHash: true,
      tenantId: true,
      userId: true,
      user: { select: { email: true } },
    },
  })
  if (!row) return null
  return {
    tenantId: row.tenantId,
    userId: row.userId,
    email: row.user.email,
    tokenHash: row.tokenHash,
  }
}

/**
 * Mark a token consumed. Returns the count of rows affected — 0 means
 * concurrent consumption (raced with another set-password attempt) or
 * the token was never valid. Caller decides whether to treat 0 as a
 * client error.
 */
export async function markTokenUsed(
  tx: PrismaLike,
  tokenHash: string,
): Promise<{ count: number }> {
  const res = await tx.passwordSetToken.updateMany({
    where: { tokenHash, usedAt: null },
    data: { usedAt: new Date() },
  })
  return { count: res.count }
}
