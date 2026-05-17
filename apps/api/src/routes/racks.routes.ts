import type { FastifyInstance } from 'fastify'
import {
  createRackResponseSchema,
  duplicateRackResponseSchema,
  getRackResponseSchema,
  listRacksResponseSchema,
  patchRackBodySchema,
  patchRackParamsSchema,
  patchRackResponseSchema,
  problemDetailSchema,
  UserRole,
  type ListRacksResponse,
  type PatchRackBody,
  type PatchRackParams,
} from '@cems/types'
import { z } from 'zod'
import { fastifySchemaFromZod } from '../lib/schema.js'
import { requireRole } from '../middleware/role-guard.js'
import * as rackService from '../services/rack.service.js'

const racksParamsSchema = z.object({
  auditId: z.string().min(1),
  roomId: z.string().min(1),
})

const emptyBodySchema = z.object({}).passthrough()

export function registerRacksRoutes(app: FastifyInstance): void {
  // POST — create a new rack under a machine room. AUDITOR only.
  app.post(
    '/api/v1/audits/:auditId/machine-rooms/:roomId/racks',
    {
      preHandler: requireRole([UserRole.AUDITOR]),
      schema: fastifySchemaFromZod({
        tags: ['racks'],
        summary: 'Create a rack under a machine room. AUDITOR only; must own DRAFT audit. Story 3.2.',
        params: racksParamsSchema,
        body: emptyBodySchema,
        response: {
          200: createRackResponseSchema,
          401: problemDetailSchema,
          403: problemDetailSchema,
          404: problemDetailSchema,
          422: problemDetailSchema,
        },
      }),
    },
    async (request, reply) => {
      const { auditId, roomId } = request.params as { auditId: string; roomId: string }
      const result = await rackService.createRack({ machineRoomId: roomId, auditId }, { request })
      return reply.code(200).send(result)
    },
  )

  // GET — list all racks for a machine room (any authenticated role).
  app.get(
    '/api/v1/audits/:auditId/machine-rooms/:roomId/racks',
    {
      preHandler: requireRole([UserRole.AUDITOR, UserRole.ADMIN, UserRole.CLIENT]),
      schema: fastifySchemaFromZod({
        tags: ['racks'],
        summary: 'List racks for a machine room. Any authenticated role. Story 3.2.',
        params: racksParamsSchema,
        response: {
          200: listRacksResponseSchema,
          401: problemDetailSchema,
          403: problemDetailSchema,
          404: problemDetailSchema,
        },
      }),
    },
    async (request, reply) => {
      const { auditId, roomId } = request.params as { auditId: string; roomId: string }
      const racks = await rackService.getRacks({ machineRoomId: roomId, auditId }, { request })
      return reply.code(200).send({ racks } as ListRacksResponse)
    },
  )

  // GET — single rack by id (any authenticated role).
  app.get(
    '/api/v1/audits/:auditId/machine-rooms/:roomId/racks/:rackId',
    {
      preHandler: requireRole([UserRole.AUDITOR, UserRole.ADMIN, UserRole.CLIENT]),
      schema: fastifySchemaFromZod({
        tags: ['racks'],
        summary: 'Get a single rack. Any authenticated role. Story 3.2.',
        params: patchRackParamsSchema,
        response: {
          200: getRackResponseSchema,
          401: problemDetailSchema,
          403: problemDetailSchema,
          404: problemDetailSchema,
        },
      }),
    },
    async (request, reply) => {
      const params = request.params as PatchRackParams
      const result = await rackService.getRackById(
        { rackId: params.rackId, machineRoomId: params.roomId, auditId: params.auditId },
        { request },
      )
      return reply.code(200).send(result)
    },
  )

  // PATCH — auto-save rack data. AUDITOR only.
  app.patch(
    '/api/v1/audits/:auditId/machine-rooms/:roomId/racks/:rackId',
    {
      preHandler: requireRole([UserRole.AUDITOR]),
      schema: fastifySchemaFromZod({
        tags: ['racks'],
        summary: 'Auto-save rack data. AUDITOR only; must own DRAFT audit. Story 3.2.',
        params: patchRackParamsSchema,
        body: patchRackBodySchema,
        response: {
          200: patchRackResponseSchema,
          401: problemDetailSchema,
          403: problemDetailSchema,
          404: problemDetailSchema,
          422: problemDetailSchema,
        },
      }),
    },
    async (request, reply) => {
      const params = request.params as PatchRackParams
      const body = request.body as PatchRackBody
      const result = await rackService.patchRack(
        { rackId: params.rackId, machineRoomId: params.roomId, auditId: params.auditId, data: body.data },
        { request },
      )
      return reply.code(200).send(result)
    },
  )

  // POST — duplicate a rack (copies data minus rackDesignation). AUDITOR only.
  app.post(
    '/api/v1/audits/:auditId/machine-rooms/:roomId/racks/:rackId/duplicate',
    {
      preHandler: requireRole([UserRole.AUDITOR]),
      schema: fastifySchemaFromZod({
        tags: ['racks'],
        summary: 'Duplicate a rack, clearing its designation. AUDITOR only. Story 3.2.',
        params: patchRackParamsSchema,
        body: emptyBodySchema,
        response: {
          200: duplicateRackResponseSchema,
          401: problemDetailSchema,
          403: problemDetailSchema,
          404: problemDetailSchema,
          422: problemDetailSchema,
        },
      }),
    },
    async (request, reply) => {
      const params = request.params as PatchRackParams
      const result = await rackService.duplicateRack(
        { rackId: params.rackId, machineRoomId: params.roomId, auditId: params.auditId },
        { request },
      )
      return reply.code(200).send(result)
    },
  )
}
