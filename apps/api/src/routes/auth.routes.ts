import type { FastifyInstance } from 'fastify'
import {
  loginRequestSchema,
  loginResponseSchema,
  logoutRequestSchema,
  refreshRequestSchema,
  problemDetailSchema,
} from '@cems/types'
import { fastifySchemaFromZod } from '../lib/schema.js'
import * as authService from '../services/auth.service.js'

export function registerAuthRoutes(app: FastifyInstance): void {
  app.post(
    '/api/v1/auth/login',
    {
      schema: fastifySchemaFromZod({
        tags: ['auth'],
        summary: 'Email/password login → access + refresh tokens',
        body: loginRequestSchema,
        response: {
          200: loginResponseSchema,
          401: problemDetailSchema,
          422: problemDetailSchema,
        },
      }),
    },
    async (request, reply) => {
      // Body is already Zod-validated by Fastify's Ajv pass — but we still
      // need to coerce types (email is .toLowerCase().trim() in the schema).
      const body = loginRequestSchema.parse(request.body)
      const tokens = await authService.login(body)
      return reply.code(200).send(tokens)
    },
  )

  app.post(
    '/api/v1/auth/refresh',
    {
      schema: fastifySchemaFromZod({
        tags: ['auth'],
        summary: 'Rotate the refresh token and issue a fresh access token',
        body: refreshRequestSchema,
        response: {
          200: loginResponseSchema,
          401: problemDetailSchema,
          422: problemDetailSchema,
        },
      }),
    },
    async (request, reply) => {
      const body = refreshRequestSchema.parse(request.body)
      const tokens = await authService.refresh(body)
      return reply.code(200).send(tokens)
    },
  )

  app.post(
    '/api/v1/auth/logout',
    {
      schema: fastifySchemaFromZod({
        tags: ['auth'],
        summary: 'Idempotent logout — revoke a refresh token',
        body: logoutRequestSchema,
        response: {
          204: refreshRequestSchema.pick({ refreshToken: true }).strip().partial(),
          422: problemDetailSchema,
        },
      }),
    },
    async (request, reply) => {
      const body = logoutRequestSchema.parse(request.body)
      await authService.logout(body)
      return reply.code(204).send()
    },
  )
}
