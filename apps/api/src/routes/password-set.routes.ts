import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  passwordSetRequestSchema,
  passwordSetValidateResponseSchema,
  problemDetailSchema,
} from '@cems/types'
import { fastifySchemaFromZod } from '../lib/schema.js'
import * as passwordSetService from '../services/password-set.service.js'

const validateQuerySchema = z.object({ token: z.string().min(1) })

export function registerPasswordSetRoutes(app: FastifyInstance): void {
  app.get(
    '/api/v1/auth/password-set/validate',
    {
      schema: fastifySchemaFromZod({
        tags: ['auth'],
        summary: 'Check whether a welcome-email password-set token is still valid',
        querystring: validateQuerySchema,
        response: { 200: passwordSetValidateResponseSchema, 404: problemDetailSchema },
      }),
    },
    async (request, reply) => {
      const { token } = validateQuerySchema.parse(request.query)
      const ok = await passwordSetService.validateToken(token)
      if (!ok) {
        return reply.code(404).type('application/problem+json').send({
          type: 'https://cems.starenergy.ca/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: 'Invalid or expired link',
          instance: request.url,
        })
      }
      return reply.code(200).send({ valid: true as const, email: ok.email })
    },
  )

  app.post(
    '/api/v1/auth/password-set',
    {
      schema: fastifySchemaFromZod({
        tags: ['auth'],
        summary: 'Consume a welcome-email link to set the user’s initial password',
        body: passwordSetRequestSchema,
        response: { 204: z.object({}).strip(), 401: problemDetailSchema, 422: problemDetailSchema },
      }),
    },
    async (request, reply) => {
      const body = passwordSetRequestSchema.parse(request.body)
      await passwordSetService.setPassword(body)
      return reply.code(204).send()
    },
  )
}
