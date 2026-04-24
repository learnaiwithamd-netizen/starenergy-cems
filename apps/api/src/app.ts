import Fastify, { type FastifyInstance } from 'fastify'
import { prisma } from '@cems/db'

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
    },
  })

  app.get('/api/v1/health', async () => ({ status: 'ok' }))

  /**
   * db-health — proves the @cems/db import path works end-to-end.
   *
   * ⚠️  NEVER read tenant-scoped tables from this route. It runs a raw `$queryRaw`
   * without going through `withRlsContext`, so SESSION_CONTEXT from a prior pooled-
   * connection user may still be set. `SELECT 1` is safe because it touches no
   * tenant data. Story 0.4 will add authenticated, RLS-context-wrapped routes for
   * anything that reads real data.
   *
   * Route is intentionally unauthenticated — it's the Azure App Service health probe target.
   */
  app.get('/api/v1/db-health', async () => {
    const result = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 AS ok`
    return { status: 'ok', db: result[0]?.ok === 1 ? 'connected' : 'unreachable' }
  })

  return app
}
