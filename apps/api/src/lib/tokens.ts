import { SignJWT } from 'jose'
import { createHash, randomBytes } from 'node:crypto'
import {
  ACCESS_TOKEN_TTL_BY_ROLE,
  REFRESH_TOKEN_TTL_BY_ROLE,
  JWT_ISSUER,
  JWT_AUDIENCE,
  type UserRole,
} from '@cems/types'

// ─── HS256 signing key cache ───────────────────────────────────────────
// Cached on first call so a mid-process JWT_SECRET env mutation does NOT
// silently take effect — secret rotation requires a process restart (matches
// deployed-env behaviour where Key Vault references are read at App Service
// start). HS256 minimum key length per RFC 7518 §3.2 is 32 bytes.

let _cachedSecretBytes: Uint8Array | undefined
let _cachedSecretSource: string | undefined

export function getJwtSecret(): Uint8Array {
  const secret = process.env['JWT_SECRET']
  if (!secret) {
    throw new Error('JWT_SECRET is not set')
  }
  if (secret.length < 32) {
    throw new Error(
      `JWT_SECRET must be at least 32 characters (HS256 RFC 7518 §3.2). Got ${secret.length}.`,
    )
  }
  if (_cachedSecretBytes && _cachedSecretSource === secret) {
    return _cachedSecretBytes
  }
  _cachedSecretBytes = new TextEncoder().encode(secret)
  _cachedSecretSource = secret
  return _cachedSecretBytes
}

// Test-only reset; never used at runtime.
export function __resetJwtSecretCacheForTests(): void {
  _cachedSecretBytes = undefined
  _cachedSecretSource = undefined
}

// ─── Access token issuance ─────────────────────────────────────────────

export interface AccessTokenSubject {
  id: string
  tenantId: string
  role: UserRole
  assignedStoreIds: string[]
}

export interface IssuedAccessToken {
  token: string
  expiresIn: number // seconds
}

export async function issueAccessToken(user: AccessTokenSubject): Promise<IssuedAccessToken> {
  const expiresIn = ACCESS_TOKEN_TTL_BY_ROLE[user.role]
  const now = Math.floor(Date.now() / 1000)
  const token = await new SignJWT({
    tenantId: user.tenantId,
    role: user.role,
    assignedStoreIds: user.assignedStoreIds,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + expiresIn)
    .sign(getJwtSecret())
  return { token, expiresIn }
}

// ─── Refresh token generation + lookup hashing ─────────────────────────

export interface GeneratedRefreshToken {
  token: string //   plaintext base64url(64 random bytes) — return to client only
  hash: string //    sha256 hex — persisted in user_sessions.refresh_token_hash
  expiresAt: Date // absolute expiry per role
}

const REFRESH_TOKEN_BYTES = 64

export function generateRefreshToken(role: UserRole): GeneratedRefreshToken {
  const ttlSeconds = REFRESH_TOKEN_TTL_BY_ROLE[role]
  const token = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url')
  return {
    token,
    hash: hashRefreshToken(token),
    expiresAt: new Date(Date.now() + ttlSeconds * 1000),
  }
}

/**
 * Deterministic SHA-256 hex hash of a refresh token. Used at refresh/logout
 * lookup time. SHA-256 (vs argon2) is the right choice here because refresh
 * tokens are 64-byte cryptographically-random secrets, not low-entropy
 * passwords — work-factor hashing offers no defence and breaks the lookup
 * pattern (deterministic hash needed to find the row).
 */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
