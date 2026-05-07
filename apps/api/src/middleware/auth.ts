import type { FastifyInstance, FastifyRequest } from 'fastify'
import { jwtVerify, errors as joseErrors } from 'jose'
import { accessTokenClaimsSchema, JWT_ISSUER, JWT_AUDIENCE } from '@cems/types'
import type { RlsContext } from '@cems/db'
import { getJwtSecret } from '../lib/tokens.js'
import { TokenExpiredError } from '../lib/auth-errors.js'

declare module 'fastify' {
  interface FastifyRequest {
    rlsContext: RlsContext | null
  }
}

// Public routes — exact list per Story 0.4 spec § Public route allowlist.
// Adding a new entry here REQUIRES an architecture-review note in the next story's Dev Notes.
const PUBLIC_ROUTES = new Set<string>([
  '/api/v1/health',
  '/api/v1/db-health',
  '/api/v1/docs',
  '/api/v1/docs/json',
  '/api/v1/docs/yaml',
  '/api/v1/auth/login',
  '/api/v1/auth/refresh',
  '/api/v1/auth/logout',
])

// Static assets served by @fastify/swagger-ui live under `/api/v1/docs/static/...`.
// Restricted prefix-match (NOT the whole `/api/v1/docs/*` namespace) so a future
// `/api/v1/docs/admin-internal` does not become accidentally public.
const PUBLIC_STATIC_PREFIX = '/api/v1/docs/static/'

function isPublicRoute(url: string): boolean {
  // Strip query string and trailing slash
  const path = (url.split('?')[0] ?? url).replace(/\/$/, '') || '/'
  if (PUBLIC_ROUTES.has(path)) return true
  return path.startsWith(PUBLIC_STATIC_PREFIX)
}

const BEARER_PREFIX_RE = /^bearer\s+/i

export function registerAuthHook(app: FastifyInstance): void {
  app.decorateRequest('rlsContext', null)

  app.addHook('preHandler', async (request: FastifyRequest, reply) => {
    if (isPublicRoute(request.url)) {
      return
    }

    // Defensive: undici accepts duplicate header values as `string[]`. Accept
    // the first entry only — RFC 9110 §5.3 lets us reject ambiguous headers.
    const rawAuthHeader = request.headers.authorization
    const authHeader = Array.isArray(rawAuthHeader) ? rawAuthHeader[0] : rawAuthHeader
    if (!authHeader || !BEARER_PREFIX_RE.test(authHeader)) {
      // RFC 7235 §4.1 — challenge unauthenticated clients with WWW-Authenticate.
      void reply.header('WWW-Authenticate', 'Bearer')
      throw app.httpErrors.unauthorized('Missing or malformed Authorization header')
    }

    const token = authHeader.replace(BEARER_PREFIX_RE, '').trim()
    if (!token) {
      void reply.header('WWW-Authenticate', 'Bearer')
      throw app.httpErrors.unauthorized('Empty bearer token')
    }

    let payload: unknown
    try {
      const result = await jwtVerify(token, getJwtSecret(), {
        algorithms: ['HS256'],
        clockTolerance: '5s',
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      })
      payload = result.payload
    } catch (err) {
      // Surface "expired" as its own slug (token-expired) so SPA refresh logic
      // can branch on `problem.type`. All other verify failures collapse to
      // "invalid_token" — bad signature / iss / aud / malformed JWT.
      if (err instanceof joseErrors.JWTExpired) {
        request.log.warn({ err: { name: err.name } }, 'jwt expired')
        void reply.header('WWW-Authenticate', 'Bearer error="invalid_token"')
        throw new TokenExpiredError('Access token expired')
      }
      request.log.warn({ err }, 'jwt verify failed')
      void reply.header('WWW-Authenticate', 'Bearer error="invalid_token"')
      throw app.httpErrors.unauthorized('Invalid token')
    }

    const claims = accessTokenClaimsSchema.safeParse(payload)
    if (!claims.success) {
      request.log.warn({ errors: claims.error.errors }, 'jwt payload schema mismatch')
      void reply.header('WWW-Authenticate', 'Bearer error="invalid_token"')
      throw app.httpErrors.unauthorized('Token claims invalid')
    }

    request.rlsContext = Object.freeze({
      tenantId: claims.data.tenantId,
      userId: claims.data.sub,
      role: claims.data.role,
      assignedStoreIds: Object.freeze([...claims.data.assignedStoreIds]),
    }) as RlsContext
  })
}

export const __testing__ = { isPublicRoute }
