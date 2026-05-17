import type { FastifyInstance } from 'fastify'
import {
  createMachineRoomBodySchema,
  createMachineRoomResponseSchema,
  listMachineRoomsResponseSchema,
  patchMachineRoomBodySchema,
  patchMachineRoomParamsSchema,
  patchMachineRoomResponseSchema,
  problemDetailSchema,
  UserRole,
  type CreateMachineRoomBody,
  type PatchMachineRoomBody,
  type PatchMachineRoomParams,
  type ListMachineRoomsResponse,
} from '@cems/types'
import { z } from 'zod'
import { fastifySchemaFromZod } from '../lib/schema.js'
import { requireRole } from '../middleware/role-guard.js'
import * as machineRoomService from '../services/machine-room.service.js'

export function registerMachineRoomsRoutes(app: FastifyInstance): void {
  // POST — idempotent get-or-create for the AUDITOR's current machine room.
  app.post(
    '/api/v1/audits/:auditId/machine-rooms',
    {
      preHandler: requireRole([UserRole.AUDITOR]),
      schema: fastifySchemaFromZod({
        tags: ['machine-rooms'],
        summary: 'Get-or-create the first machine room for a DRAFT audit. AUDITOR only. Story 3.1.',
        params: z.object({ auditId: z.string().min(1) }),
        body: createMachineRoomBodySchema,
        response: {
          200: createMachineRoomResponseSchema,
          401: problemDetailSchema,
          403: problemDetailSchema,
          404: problemDetailSchema,
          422: problemDetailSchema,
        },
      }),
    },
    async (request, reply) => {
      const { auditId } = request.params as { auditId: string }
      const result = await machineRoomService.getOrCreateMachineRoom({ auditId }, { request })
      return reply.code(200).send(result)
    },
  )

  // GET — list all machine rooms for an audit (any authenticated role).
  app.get(
    '/api/v1/audits/:auditId/machine-rooms',
    {
      preHandler: requireRole([UserRole.AUDITOR, UserRole.ADMIN, UserRole.CLIENT]),
      schema: fastifySchemaFromZod({
        tags: ['machine-rooms'],
        summary: 'List machine rooms for an audit. Any authenticated role. Story 3.1.',
        params: z.object({ auditId: z.string().min(1) }),
        response: {
          200: listMachineRoomsResponseSchema,
          401: problemDetailSchema,
          403: problemDetailSchema,
          404: problemDetailSchema,
        },
      }),
    },
    async (request, reply) => {
      const { auditId } = request.params as { auditId: string }
      const machineRooms = await machineRoomService.getMachineRooms({ auditId }, { request })
      return reply.code(200).send({ machineRooms } as ListMachineRoomsResponse)
    },
  )

  // PATCH — auto-save machine room data. AUDITOR only.
  app.patch(
    '/api/v1/audits/:auditId/machine-rooms/:roomId',
    {
      preHandler: requireRole([UserRole.AUDITOR]),
      schema: fastifySchemaFromZod({
        tags: ['machine-rooms'],
        summary: 'Auto-save machine room data. AUDITOR only; must own DRAFT audit. Story 3.1.',
        params: patchMachineRoomParamsSchema,
        body: patchMachineRoomBodySchema,
        response: {
          200: patchMachineRoomResponseSchema,
          401: problemDetailSchema,
          403: problemDetailSchema,
          404: problemDetailSchema,
          422: problemDetailSchema,
        },
      }),
    },
    async (request, reply) => {
      const params = request.params as PatchMachineRoomParams
      const body = request.body as PatchMachineRoomBody
      const result = await machineRoomService.patchMachineRoom(
        { auditId: params.auditId, roomId: params.roomId, data: body.data },
        { request },
      )
      return reply.code(200).send(result)
    },
  )
}
