import type { FastifyInstance } from 'fastify'
import { listAuditsResponseSchema, problemDetailSchema } from '@cems/types'
import { fastifySchemaFromZod } from '../lib/schema.js'
import { listAuditsForCaller } from '../repositories/audit.repo.js'

/**
 * Story 1.4 STUB. The full audit feature lives in Epic 2 (DRAFT creation,
 * auto-save, etc.) and Story 7.1 (admin queue with filtering/pagination).
 * This file ships ONLY the minimum needed to validate AC2 (CLIENT users
 * see only audits for their assigned stores via RLS).
 *
 * No role guard — every authenticated role can list. Azure SQL's
 * `security.fn_audits_filter` does the per-tenant + per-store filtering.
 */
export function registerAuditsRoutes(app: FastifyInstance): void {
  app.get(
    '/api/v1/audits',
    {
      schema: fastifySchemaFromZod({
        tags: ['audits'],
        summary: 'List audits visible to the caller (RLS-scoped). Story 1.4 stub.',
        response: {
          200: listAuditsResponseSchema,
          401: problemDetailSchema,
        },
      }),
    },
    async (request, reply) => {
      const result = await request.withRls((tx) => listAuditsForCaller(tx))
      return reply.code(200).send(result)
    },
  )
}
