import Fastify, { type FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import swagger from '@fastify/swagger'
import swaggerUI from '@fastify/swagger-ui'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { prisma } from '@cems/db'
import { logger } from './lib/logger.js'
import { fastifySchemaFromZod } from './lib/schema.js'
import { buildErrorHandler } from './middleware/error-handler.js'
import { registerAuthHook } from './middleware/auth.js'
import { registerRlsRequestHook } from './middleware/rls-request.js'

declare module 'fastify' {
  interface FastifyRequest {
    startTime: number
  }
}

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    loggerInstance: logger,
    genReqId: () => randomUUID(),
    disableRequestLogging: true, // we emit our own structured log line in onResponse
  }) as unknown as FastifyInstance

  await app.register(sensible)

  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: { title: 'CEMS API', version: '0.0.1' },
      servers: [{ url: '/' }],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
    },
  })

  await app.register(swaggerUI, {
    routePrefix: '/api/v1/docs',
    uiConfig: { docExpansion: 'list' },
  })

  app.setErrorHandler(buildErrorHandler())

  // Per-request: structured access log on response.
  app.addHook('onRequest', async (request) => {
    request.startTime = Date.now()
  })

  app.addHook('onResponse', async (request, reply) => {
    const duration_ms = Date.now() - request.startTime
    const ctx = request.rlsContext
    request.log.info(
      {
        request_id: request.id,
        method: request.method,
        route: request.routeOptions?.url ?? request.url,
        status_code: reply.statusCode,
        duration_ms,
        tenant_id: ctx?.tenantId ?? null,
        user_id: ctx?.userId ?? null,
        user_role: ctx?.role ?? null,
      },
      'request completed',
    )
  })

  registerAuthHook(app)
  registerRlsRequestHook(app)

  // ─── Public routes ─────────────────────────────────────────────────────
  app.get(
    '/api/v1/health',
    {
      schema: fastifySchemaFromZod({
        tags: ['health'],
        summary: 'Liveness probe — returns 200 when the API process is running.',
        response: { 200: z.object({ status: z.literal('ok') }) },
      }),
    },
    async () => ({ status: 'ok' as const }),
  )

  /**
   * db-health: proves the @cems/db import path works end-to-end.
   *
   * ⚠️  NEVER read tenant-scoped tables from this route. It runs raw `$queryRaw`
   * without going through `withRlsTransaction`, so SESSION_CONTEXT from a prior
   * pooled-connection user may still be set. `SELECT 1` is safe — it touches no
   * tenant data.
   */
  app.get(
    '/api/v1/db-health',
    {
      schema: fastifySchemaFromZod({
        tags: ['health'],
        summary: 'Readiness probe — confirms DB reachability via SELECT 1. NEVER read tenant data here.',
        response: {
          200: z.object({ status: z.literal('ok'), db: z.enum(['connected', 'unreachable']) }),
        },
      }),
    },
    async () => {
      const result = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 AS ok`
      return { status: 'ok' as const, db: result[0]?.ok === 1 ? ('connected' as const) : ('unreachable' as const) }
    },
  )

  return app
}
