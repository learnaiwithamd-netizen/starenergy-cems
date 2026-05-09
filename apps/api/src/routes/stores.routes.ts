import type { FastifyInstance } from 'fastify'
import {
  listStoresQuerySchema,
  listStoresResponseSchema,
  storeDetailSchema,
  problemDetailSchema,
} from '@cems/types'
import { z } from 'zod'
import { fastifySchemaFromZod } from '../lib/schema.js'
import * as storeService from '../services/store.service.js'

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

  app.get(
    '/api/v1/stores/:storeNumber',
    {
      schema: fastifySchemaFromZod({
        tags: ['stores'],
        summary: 'Get full store detail by storeNumber (Redis-cached 1 h). Story 2.2.',
        params: z.object({ storeNumber: z.string().min(1) }),
        response: {
          200: storeDetailSchema,
          401: problemDetailSchema,
          404: problemDetailSchema,
        },
      }),
    },
    async (request, reply) => {
      const { storeNumber } = request.params as { storeNumber: string }
      const store = await storeService.getStoreDetail(storeNumber, { request })
      if (!store) throw app.httpErrors.notFound(`Store ${storeNumber} not found`)
      return reply.code(200).send(store)
    },
  )
}
