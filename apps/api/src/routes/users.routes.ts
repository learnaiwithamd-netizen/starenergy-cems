import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  UserRole,
  adminUserSchema,
  createUserRequestSchema,
  listUsersResponseSchema,
  problemDetailSchema,
  updateUserRequestSchema,
  userStatusSchema,
} from '@cems/types'
import { fastifySchemaFromZod } from '../lib/schema.js'
import { requireRole } from '../middleware/role-guard.js'
import * as userService from '../services/user.service.js'

const idParamsSchema = z.object({ id: z.string().min(1) })
const listQuerySchema = z.object({
  role: z.literal(UserRole.AUDITOR),
  status: userStatusSchema.optional(),
})

export function registerUsersRoutes(app: FastifyInstance): void {
  app.post(
    '/api/v1/users',
    {
      preHandler: requireRole([UserRole.ADMIN]),
      schema: fastifySchemaFromZod({
        tags: ['admin'],
        summary: 'Create a new auditor account (Story 1.3)',
        body: createUserRequestSchema,
        response: { 201: adminUserSchema, 401: problemDetailSchema, 403: problemDetailSchema, 409: problemDetailSchema },
      }),
    },
    async (request, reply) => {
      const body = createUserRequestSchema.parse(request.body)
      const created = await userService.createAuditor(body, { request })
      return reply.code(201).send(created)
    },
  )

  app.patch(
    '/api/v1/users/:id',
    {
      preHandler: requireRole([UserRole.ADMIN]),
      schema: fastifySchemaFromZod({
        tags: ['admin'],
        summary: 'Update an auditor account (name, email, status)',
        params: idParamsSchema,
        body: updateUserRequestSchema,
        response: {
          200: adminUserSchema,
          400: problemDetailSchema,
          401: problemDetailSchema,
          403: problemDetailSchema,
          404: problemDetailSchema,
          409: problemDetailSchema,
        },
      }),
    },
    async (request, reply) => {
      const { id } = idParamsSchema.parse(request.params)
      const patch = updateUserRequestSchema.parse(request.body)
      const result = await userService.updateUser(id, patch, { request })
      if (!result) {
        return reply.code(404).type('application/problem+json').send({
          type: 'https://cems.starenergy.ca/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: 'User not found in your tenant',
          instance: request.url,
        })
      }
      return reply.code(200).send(result.user)
    },
  )

  app.get(
    '/api/v1/users',
    {
      preHandler: requireRole([UserRole.ADMIN]),
      schema: fastifySchemaFromZod({
        tags: ['admin'],
        summary: 'List auditor accounts in the admin’s tenant (RLS)',
        querystring: listQuerySchema,
        response: { 200: listUsersResponseSchema, 401: problemDetailSchema, 403: problemDetailSchema },
      }),
    },
    async (request, reply) => {
      const query = listQuerySchema.parse(request.query)
      const result = await userService.listUsersByRole(query.role, query.status, { request })
      return reply.code(200).send(result)
    },
  )
}
