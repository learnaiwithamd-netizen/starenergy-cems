import { InvalidCredentialsError } from '../lib/auth-errors.js'
import { hashPassword } from '../lib/passwords.js'
import { sha256Hex } from '../lib/tokens.js'
import { withSystemAuth } from '../lib/system-auth-context.js'
import { findActiveToken, markTokenUsed } from '../repositories/password-set-token.repo.js'

export interface ValidatedToken {
  email: string
}

/**
 * Public token-validate endpoint helper. Returns the user's email if the
 * token's hash exists, has `usedAt: null`, and `expiresAt > now`. Returns
 * null otherwise — caller should respond 404 (NOT 401) to keep the no-
 * enumeration discipline: we do not distinguish unknown vs expired vs used.
 */
export async function validateToken(tokenPlain: string): Promise<ValidatedToken | null> {
  if (!tokenPlain) return null
  const hash = sha256Hex(tokenPlain)
  const lookup = await withSystemAuth((tx) => findActiveToken(tx, hash))
  if (!lookup) return null
  return { email: lookup.email }
}

/**
 * Public set-password endpoint helper. Atomic: lookup token, update user's
 * passwordHash, mark token used — all inside a single withSystemAuth tx
 * so a connection drop mid-flow can't leave the password set without the
 * token consumed (or vice versa).
 *
 * Throws InvalidCredentialsError on any failure (unknown / used / expired
 * token, or a concurrent claim that beat us to the markTokenUsed update).
 */
export async function setPassword(input: { token: string; password: string }): Promise<void> {
  const hash = sha256Hex(input.token)
  const newPasswordHash = await hashPassword(input.password)

  await withSystemAuth(async (tx) => {
    const lookup = await findActiveToken(tx, hash)
    if (!lookup) throw new InvalidCredentialsError('Invalid or expired link')
    // Mark used FIRST: if a concurrent caller raced us, count=0 and we abort
    // before mutating the user's password.
    const { count } = await markTokenUsed(tx, hash)
    if (count === 0) throw new InvalidCredentialsError('Invalid or expired link')
    await tx.user.update({
      where: { id: lookup.userId },
      data: { passwordHash: newPasswordHash },
      select: { id: true },
    })
  })
}
