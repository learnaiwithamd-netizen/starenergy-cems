import type { FastifyInstance, FastifyRequest } from 'fastify'
import { jwtVerify } from 'jose'
import { z } from 'zod'
import { UserRole } from '@cems/types'
import type { RlsContext } from '@cems/db'

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
])

// Static assets served by @fastify/swagger-ui live under `/api/v1/docs/static/...`.
// Restricted prefix-match (NOT the whole `/api/v1/docs/*` namespace) so a future
// `/api/v1/docs/admin-internal` does not become accidentally public.
const PUBLIC_STATIC_PREFIX = '/api/v1/docs/static/'

const jwtClaimsSchema = z.object({
  sub: z.string().min(1),
  tenantId: z.string().min(1),
  role: z.nativeEnum(UserRole),
  assignedStoreIds: z.array(z.string()).default([]),
  iat: z.number().int(),
  exp: z.number().int(),
})

function isPublicRoute(url: string): boolean {
  // Strip query string and trailing slash
  const path = (url.split('?')[0] ?? url).replace(/\/$/, '') || '/'
  if (PUBLIC_ROUTES.has(path)) return true
  return path.startsWith(PUBLIC_STATIC_PREFIX)
}

let _cachedSecretBytes: Uint8Array | undefined
let _cachedSecretSource: string | undefined

/**
 * Returns the HS256 signing key. Validates length ≥ 32 bytes (HS256 minimum per RFC 7518 §3.2).
 * Cached on first call so a mid-process JWT_SECRET env mutation does NOT silently take effect —
 * secret rotation requires a process restart (matches deployed-env behaviour where Key Vault
 * references are read at App Service start).
 */
function getJwtSecret(): Uint8Array {
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

const BEARER_PREFIX_RE = /^bearer\s+/i

export function registerAuthHook(app: FastifyInstance): void {
  app.decorateRequest('rlsContext', null)

  app.addHook('preHandler', async (request: FastifyRequest, reply) => {
    if (isPublicRoute(request.url)) {
      return
    }

    const authHeader = request.headers.authorization
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
      })
      payload = result.payload
    } catch (err) {
      request.log.warn({ err }, 'jwt verify failed')
      void reply.header('WWW-Authenticate', 'Bearer error="invalid_token"')
      throw app.httpErrors.unauthorized('Invalid token')
    }

    const claims = jwtClaimsSchema.safeParse(payload)
    if (!claims.success) {
      request.log.warn({ errors: claims.error.errors }, 'jwt payload schema mismatch')
      void reply.header('WWW-Authenticate', 'Bearer error="invalid_token"')
      throw app.httpErrors.unauthorized('Token claims invalid')
    }

    request.rlsContext = {
      tenantId: claims.data.tenantId,
      userId: claims.data.sub,
      role: claims.data.role,
      assignedStoreIds: claims.data.assignedStoreIds,
    }
  })
}

export const __testing__ = { isPublicRoute, jwtClaimsSchema }
