import argon2 from 'argon2'
import { randomBytes } from 'node:crypto'

// OWASP 2024 Argon2id minimum recommendations.
//   memoryCost: 19 MiB → 19456 KiB
//   timeCost:  2 iterations
//   parallelism: 1 lane
// These produce ~30ms hashes on a modern Linux server. If a deployment
// target struggles, raise memory before iterations (memory-hard is the
// primary defence).
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const satisfies argon2.Options

export async function hashPassword(plaintext: string): Promise<string> {
  return argon2.hash(plaintext, ARGON2_OPTIONS)
}

/**
 * Verifies a password against an argon2 hash. Returns false on any failure
 * (wrong password, malformed hash, unsupported algo). Never throws — auth
 * flows depend on a stable boolean return.
 */
export async function verifyPassword(hash: string, plaintext: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plaintext)
  } catch {
    return false
  }
}

/**
 * Lazily-computed argon2id hash of a 32-byte random string. Used by the
 * login service to consume comparable verify-time when the supplied email
 * does not match any user, so request timing does not distinguish
 * unknown-email from wrong-password (AC2 — no enumeration).
 *
 * The plaintext is generated at first access and never persisted, so even
 * an attacker with the running process's memory cannot construct a
 * password that verifies against this hash.
 */
let _dummyHashPromise: Promise<string> | undefined
export function getDummyPasswordHash(): Promise<string> {
  if (!_dummyHashPromise) {
    const plaintext = randomBytes(32).toString('base64url')
    _dummyHashPromise = hashPassword(plaintext)
  }
  return _dummyHashPromise
}
