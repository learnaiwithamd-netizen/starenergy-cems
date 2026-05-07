/**
 * Auth-flow error types. Both extend Error and expose `statusCode = 401`
 * so `@fastify/sensible`'s convention picks them up automatically — but
 * the `error-handler.ts` global handler intercepts them BEFORE the generic
 * 401 mapping to inject the proper RFC 7807 slug.
 */

export class TokenExpiredError extends Error {
  readonly statusCode = 401
  constructor(message = 'Access token expired') {
    super(message)
    this.name = 'TokenExpiredError'
  }
}

/**
 * Thrown by auth.service for ANY login/refresh/logout failure path that the
 * client must NOT be able to distinguish (unknown email, wrong password,
 * unknown refresh token, revoked refresh token, expired refresh token).
 * Always emits the SAME `Invalid email or password` problem detail.
 */
export class InvalidCredentialsError extends Error {
  readonly statusCode = 401
  constructor(message = 'Invalid email or password') {
    super(message)
    this.name = 'InvalidCredentialsError'
  }
}

/**
 * Thrown by `requireRole(...)` when the authenticated caller's role is not
 * in the allowlist. Maps to RFC 7807 403 with slug `forbidden` and a fixed
 * `detail: 'Role not permitted'` so the SPA can branch on `problem.type`.
 */
export class RoleNotPermittedError extends Error {
  readonly statusCode = 403
  constructor(message = 'Role not permitted') {
    super(message)
    this.name = 'RoleNotPermittedError'
  }
}
