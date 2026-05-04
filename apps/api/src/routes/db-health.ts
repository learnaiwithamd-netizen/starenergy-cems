/**
 * db-health: proves the @cems/db import path works end-to-end.
 *
 * ⚠️  NEVER read tenant-scoped tables from this route. It runs raw `$queryRaw`
 * without going through `withRlsTransaction`, so SESSION_CONTEXT from a prior
 * pooled-connection user may still be set. `SELECT 1` is safe — it touches no
 * tenant data.
 *
 * This file is allowlisted by the `@cems/config/eslint` rule
 * `no-tenant-raw-prisma` (path-based match on `db-health.ts`); raw Prisma
 * use is intentional here and reviewed.
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@cems/db'
import { fastifySchemaFromZod } from '../lib/schema.js'

export function registerDbHealthRoute(app: FastifyInstance): void {
  app.get(
    '/api/v1/db-health',
    {
      schema: fastifySchemaFromZod({
        tags: ['health'],
        summary:
          'Readiness probe — confirms DB reachability via SELECT 1. NEVER read tenant data here.',
        response: {
          200: z.object({
            status: z.literal('ok'),
            db: z.enum(['connected', 'unreachable']),
          }),
        },
      }),
    },
    async () => {
      const result = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 AS ok`
      return {
        status: 'ok' as const,
        db: result[0]?.ok === 1 ? ('connected' as const) : ('unreachable' as const),
      }
    },
  )
}
