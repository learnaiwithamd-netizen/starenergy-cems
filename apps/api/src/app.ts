import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import sensible from '@fastify/sensible'
import swagger from '@fastify/swagger'
import swaggerUI from '@fastify/swagger-ui'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { logger } from './lib/logger.js'
import { fastifySchemaFromZod } from './lib/schema.js'
import { buildErrorHandler } from './middleware/error-handler.js'
import { registerAuthHook } from './middleware/auth.js'
import { registerRlsRequestHook } from './middleware/rls-request.js'
import { registerAuditsRoutes } from './routes/audits.routes.js'
import { registerMachineRoomsRoutes } from './routes/machine-rooms.routes.js'
import { registerRacksRoutes } from './routes/racks.routes.js'
import { registerAuthRoutes } from './routes/auth.routes.js'
import { registerDbHealthRoute } from './routes/db-health.js'
import { registerMeRoutes } from './routes/me.routes.js'
import { registerPasswordSetRoutes } from './routes/password-set.routes.js'
import { registerStoresRoutes } from './routes/stores.routes.js'
import { registerUsersRoutes } from './routes/users.routes.js'

const DEFAULT_DEV_ORIGINS = [
  'http://localhost:5173', // audit-app
  'http://localhost:5174', // admin-app
  'http://localhost:5175', // client-portal
]

function getCorsOrigins(): string[] {
  const raw = process.env['CORS_ORIGINS']
  if (!raw) return DEFAULT_DEV_ORIGINS
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

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

  // CORS is registered BEFORE the auth hook so OPTIONS preflights are
  // handled by the plugin (and the auth hook's OPTIONS short-circuit
  // means the preflight reaches the cors plugin's reply).
  await app.register(cors, {
    origin: getCorsOrigins(),
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
    credentials: false, // Bearer-token auth only — never use cookies.
    maxAge: 86_400, // cache preflight for 24h
  })

  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: { title: 'CEMS API', version: '0.0.1' },
      servers: [{ url: '/api/v1' }],
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

  registerDbHealthRoute(app)
  registerAuthRoutes(app)
  registerMeRoutes(app)
  registerUsersRoutes(app)
  registerPasswordSetRoutes(app)
  registerAuditsRoutes(app)
  registerMachineRoomsRoutes(app)
  registerRacksRoutes(app)
  registerStoresRoutes(app)

  return app
}
