import type { FastifyInstance } from 'fastify'
import { meResponseSchema, problemDetailSchema } from '@cems/types'
import { fastifySchemaFromZod } from '../lib/schema.js'
import { findActiveUserById } from '../repositories/user.repo.js'

export function registerMeRoutes(app: FastifyInstance): void {
  app.get(
    '/api/v1/me',
    {
      schema: fastifySchemaFromZod({
        tags: ['auth'],
        summary: 'Returns the authenticated user profile',
        response: {
          200: meResponseSchema,
          401: problemDetailSchema,
        },
      }),
    },
    async (request, reply) => {
      // The auth hook has populated rlsContext; we trust the JWT for tenant
      // and storeIds, but we hit the DB to fetch fields the JWT doesn't
      // carry (email, name) and to confirm the user still exists.
      const user = await request.withRls((tx) => findActiveUserById(tx, request.rlsContext!.userId))
      if (!user) {
        // User was deleted between token issue and this request.
        return reply.code(401).type('application/problem+json').send({
          type: 'https://cems.starenergy.ca/errors/authentication-required',
          title: 'Unauthorized',
          status: 401,
          detail: 'User no longer exists',
          instance: request.url,
        })
      }
      // Story 1.3: deactivated users keep a valid JWT until natural expiry
      // (verify is stateless), so /me proactively rejects INACTIVE so the
      // SPA can clear its session within one request cycle.
      if (user.status !== 'ACTIVE') {
        return reply.code(401).type('application/problem+json').send({
          type: 'https://cems.starenergy.ca/errors/authentication-required',
          title: 'Unauthorized',
          status: 401,
          detail: 'User account is not active',
          instance: request.url,
        })
      }
      return reply.code(200).send({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        assignedStoreIds: user.assignedStoreIds,
      })
    },
  )
}
