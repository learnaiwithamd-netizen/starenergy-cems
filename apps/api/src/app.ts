import Fastify, { type FastifyInstance } from 'fastify'
import { prisma } from '@cems/db'

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
    },
  })

  app.get('/api/v1/health', async () => ({ status: 'ok' }))

  // db-health: proves @cems/db import path works end-to-end. Bypasses RLS (pre-auth).
  // Story 0.4 will add real RLS-context middleware; this route is intentionally unauthenticated.
  app.get('/api/v1/db-health', async () => {
    const result = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 AS ok`
    return { status: 'ok', db: result[0]?.ok === 1 ? 'connected' : 'unreachable' }
  })

  return app
}
