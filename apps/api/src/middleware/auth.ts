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

const PUBLIC_ROUTES = new Set<string>([
  '/api/v1/health',
  '/api/v1/db-health',
  '/api/v1/auth/login',
  '/api/v1/auth/refresh',
])

const PUBLIC_ROUTE_PREFIXES = ['/api/v1/docs']

const jwtClaimsSchema = z.object({
  sub: z.string().min(1),
  tenantId: z.string().min(1),
  role: z.nativeEnum(UserRole),
  assignedStoreIds: z.array(z.string()).default([]),
  iat: z.number().int(),
  exp: z.number().int(),
})

function isPublicRoute(url: string): boolean {
  // Strip query string
  const path = url.split('?')[0] ?? url
  if (PUBLIC_ROUTES.has(path)) return true
  return PUBLIC_ROUTE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

function getJwtSecret(): Uint8Array {
  const secret = process.env['JWT_SECRET']
  if (!secret) {
    throw new Error('JWT_SECRET is not set')
  }
  return new TextEncoder().encode(secret)
}

export function registerAuthHook(app: FastifyInstance): void {
  app.decorateRequest('rlsContext', null)

  app.addHook('preHandler', async (request: FastifyRequest, _reply) => {
    if (isPublicRoute(request.url)) {
      return
    }

    const authHeader = request.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      throw app.httpErrors.unauthorized('Missing or malformed Authorization header')
    }

    const token = authHeader.slice('Bearer '.length).trim()
    if (!token) {
      throw app.httpErrors.unauthorized('Empty bearer token')
    }

    let payload: unknown
    try {
      const result = await jwtVerify(token, getJwtSecret(), { algorithms: ['HS256'] })
      payload = result.payload
    } catch (err) {
      request.log.warn({ err }, 'jwt verify failed')
      throw app.httpErrors.unauthorized('Invalid token')
    }

    const claims = jwtClaimsSchema.safeParse(payload)
    if (!claims.success) {
      request.log.warn({ errors: claims.error.errors }, 'jwt payload schema mismatch')
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
