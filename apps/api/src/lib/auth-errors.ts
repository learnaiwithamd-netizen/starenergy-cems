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
