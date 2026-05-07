import type { LoginRequest, LoginResponse, RefreshRequest, LogoutRequest } from '@cems/types'
import { InvalidCredentialsError } from '../lib/auth-errors.js'
import { withSystemAuth } from '../lib/system-auth-context.js'
import { getDummyPasswordHash, verifyPassword } from '../lib/passwords.js'
import { generateRefreshToken, hashRefreshToken, issueAccessToken } from '../lib/tokens.js'
import {
  type AuthUser,
  findActiveUserByEmail,
  findActiveUserById,
} from '../repositories/user.repo.js'
import {
  createSession,
  deleteSessionByHash,
  findActiveSessionByHash,
} from '../repositories/user-session.repo.js'

/**
 * Validates email + password and issues an access/refresh token pair.
 *
 * Failure modes — UNKNOWN_EMAIL and WRONG_PASSWORD — return the same
 * `InvalidCredentialsError` AND consume comparable wall-clock time
 * (dummy argon2.verify on the unknown-email branch). The error handler
 * emits an identical RFC 7807 401 body in both cases. AC2.
 */
export async function login(input: LoginRequest): Promise<LoginResponse> {
  const user = await withSystemAuth((tx) => findActiveUserByEmail(tx, input.email))

  // Three failure modes collapse to the SAME response shape AND comparable
  // timing: unknown email, INACTIVE user, wrong password.
  if (!user || user.status !== 'ACTIVE') {
    await verifyPassword(await getDummyPasswordHash(), input.password)
    throw new InvalidCredentialsError()
  }

  const passwordOk = await verifyPassword(user.passwordHash, input.password)
  if (!passwordOk) {
    throw new InvalidCredentialsError()
  }

  return issueTokenPairForUser(user)
}

/**
 * Validates a refresh token, rotates it, and issues a fresh access token.
 *
 * Atomicity: the old session row is deleted and the new one inserted in
 * the SAME `withSystemAuth` transaction so a connection drop mid-rotation
 * cannot leave the user with no valid session. AC5.
 */
export async function refresh(input: RefreshRequest): Promise<LoginResponse> {
  const oldHash = hashRefreshToken(input.refreshToken)

  const session = await withSystemAuth((tx) => findActiveSessionByHash(tx, oldHash))
  if (!session) {
    throw new InvalidCredentialsError()
  }

  const user = await withSystemAuth((tx) => findActiveUserById(tx, session.userId))
  if (!user) {
    // Session row pointed at a user that's been deleted (or, post-1.3,
    // deactivated). Same generic 401 — never leak the orphan-session signal.
    throw new InvalidCredentialsError()
  }

  return withSystemAuth(async (tx) => {
    // Delete first so we never store two valid hashes for the same user
    // even momentarily.
    await deleteSessionByHash(tx, oldHash)
    const issued = await issueAndPersistTokenPair(tx, user)
    return issued
  })
}

/**
 * Idempotent logout — deletes the session row that matches the supplied
 * refresh token's hash. Returns silently regardless of whether the hash
 * was known. AC6.
 */
export async function logout(input: LogoutRequest): Promise<void> {
  const hash = hashRefreshToken(input.refreshToken)
  await withSystemAuth((tx) => deleteSessionByHash(tx, hash))
}

// ─── helpers ────────────────────────────────────────────────────────────

async function issueTokenPairForUser(user: AuthUser): Promise<LoginResponse> {
  return withSystemAuth((tx) => issueAndPersistTokenPair(tx, user))
}

async function issueAndPersistTokenPair(
  tx: Parameters<Parameters<typeof withSystemAuth<unknown>>[0]>[0],
  user: AuthUser,
): Promise<LoginResponse> {
  const { token: accessToken, expiresIn } = await issueAccessToken({
    id: user.id,
    tenantId: user.tenantId,
    role: user.role,
    assignedStoreIds: user.assignedStoreIds,
  })
  const refreshToken = generateRefreshToken(user.role)
  await createSession(tx, {
    tenantId: user.tenantId,
    userId: user.id,
    refreshTokenHash: refreshToken.hash,
    expiresAt: refreshToken.expiresAt,
  })
  return {
    accessToken,
    refreshToken: refreshToken.token,
    tokenType: 'Bearer' as const,
    expiresIn,
  }
}
