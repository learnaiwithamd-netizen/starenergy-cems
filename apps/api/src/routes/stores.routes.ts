import type { FastifyInstance } from 'fastify'
import {
  listStoresQuerySchema,
  listStoresResponseSchema,
  problemDetailSchema,
} from '@cems/types'
import { fastifySchemaFromZod } from '../lib/schema.js'
import * as storeService from '../services/store.service.js'

/**
 * Story 2.1 — store reference data read API. Auth required (any role);
 * RLS scopes results to the caller's tenant. The `assignedToUser=true`
 * query flag honours `rlsContext.assignedStoreIds` for AUDITOR + CLIENT
 * callers; ADMIN ignores it.
 *
 * `GET /api/v1/stores/:storeNumber` (auto-fill source) is Story 2.2.
 */
export function registerStoresRoutes(app: FastifyInstance): void {
  app.get(
    '/api/v1/stores',
    {
      schema: fastifySchemaFromZod({
        tags: ['stores'],
        summary: 'List stores visible to the caller (RLS-scoped). Story 2.1.',
        querystring: listStoresQuerySchema,
        response: {
          200: listStoresResponseSchema,
          401: problemDetailSchema,
        },
      }),
    },
    async (request, reply) => {
      const query = listStoresQuerySchema.parse(request.query)
      const result = await storeService.listStoresForCaller(query, { request })
      return reply.code(200).send(result)
    },
  )
}
