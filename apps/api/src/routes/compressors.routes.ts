import type { FastifyInstance } from 'fastify'
import {
  compressorItemParamsSchema,
  compressorListParamsSchema,
  compressorLookupQuerySchema,
  createCompressorResponseSchema,
  duplicateCompressorResponseSchema,
  getCompressorRefResponseSchema,
  getCompressorResponseSchema,
  listCompressorsResponseSchema,
  patchCompressorBodySchema,
  patchCompressorResponseSchema,
  problemDetailSchema,
  reportUnknownModelResponseSchema,
  UserRole,
  type CompressorItemParams,
  type CompressorListParams,
  type CompressorLookupQuery,
  type ListCompressorsResponse,
  type PatchCompressorBody,
} from '@cems/types'
import { z } from 'zod'
import { fastifySchemaFromZod } from '../lib/schema.js'
import { requireRole } from '../middleware/role-guard.js'
import * as compressorService from '../services/compressor.service.js'

const emptyBodySchema = z.object({}).passthrough()
const compressorLookupParamsSchema = z.object({ model: z.string().min(1) })

export function registerCompressorsRoutes(app: FastifyInstance): void {
  // GET — global compressor regression-DB lookup (any authenticated role). NOT RLS-scoped.
  app.get(
    '/api/v1/compressors/:model',
    {
      preHandler: requireRole([UserRole.AUDITOR, UserRole.ADMIN, UserRole.CLIENT]),
      schema: fastifySchemaFromZod({
        tags: ['compressors'],
        summary: 'Look up a compressor model in the global regression DB. Any role. Story 3.3.',
        params: compressorLookupParamsSchema,
        querystring: compressorLookupQuerySchema,
        response: {
          200: getCompressorRefResponseSchema,
          401: problemDetailSchema,
          404: problemDetailSchema,
        },
      }),
    },
    async (request, reply) => {
      const { model } = request.params as { model: string }
      const { version } = request.query as CompressorLookupQuery
      const result = await compressorService.lookupCompressorRef({ model, version })
      return reply.code(200).send(result)
    },
  )

  // POST — create a compressor under a rack. AUDITOR only.
  app.post(
    '/api/v1/audits/:auditId/machine-rooms/:roomId/racks/:rackId/compressors',
    {
      preHandler: requireRole([UserRole.AUDITOR]),
      schema: fastifySchemaFromZod({
        tags: ['compressors'],
        summary: 'Create a compressor under a rack. AUDITOR only; must own DRAFT audit. Story 3.3.',
        params: compressorListParamsSchema,
        body: emptyBodySchema,
        response: {
          200: createCompressorResponseSchema,
          401: problemDetailSchema,
          403: problemDetailSchema,
          404: problemDetailSchema,
          422: problemDetailSchema,
        },
      }),
    },
    async (request, reply) => {
      const { auditId, roomId, rackId } = request.params as CompressorListParams
      const result = await compressorService.createCompressor(
        { rackId, machineRoomId: roomId, auditId },
        { request },
      )
      return reply.code(200).send(result)
    },
  )

  // GET — list all compressors for a rack (any authenticated role).
  app.get(
    '/api/v1/audits/:auditId/machine-rooms/:roomId/racks/:rackId/compressors',
    {
      preHandler: requireRole([UserRole.AUDITOR, UserRole.ADMIN, UserRole.CLIENT]),
      schema: fastifySchemaFromZod({
        tags: ['compressors'],
        summary: 'List compressors for a rack. Any authenticated role. Story 3.3.',
        params: compressorListParamsSchema,
        response: {
          200: listCompressorsResponseSchema,
          401: problemDetailSchema,
          403: problemDetailSchema,
          404: problemDetailSchema,
        },
      }),
    },
    async (request, reply) => {
      const { auditId, roomId, rackId } = request.params as CompressorListParams
      const compressors = await compressorService.getCompressors(
        { rackId, machineRoomId: roomId, auditId },
        { request },
      )
      return reply.code(200).send({ compressors } as ListCompressorsResponse)
    },
  )

  // GET — single compressor by id (any authenticated role).
  app.get(
    '/api/v1/audits/:auditId/machine-rooms/:roomId/racks/:rackId/compressors/:compressorId',
    {
      preHandler: requireRole([UserRole.AUDITOR, UserRole.ADMIN, UserRole.CLIENT]),
      schema: fastifySchemaFromZod({
        tags: ['compressors'],
        summary: 'Get a single compressor. Any authenticated role. Story 3.3.',
        params: compressorItemParamsSchema,
        response: {
          200: getCompressorResponseSchema,
          401: problemDetailSchema,
          403: problemDetailSchema,
          404: problemDetailSchema,
        },
      }),
    },
    async (request, reply) => {
      const p = request.params as CompressorItemParams
      const result = await compressorService.getCompressorById(
        { compressorId: p.compressorId, rackId: p.rackId, machineRoomId: p.roomId, auditId: p.auditId },
        { request },
      )
      return reply.code(200).send(result)
    },
  )

  // PATCH — auto-save compressor data (+ optional compressorRefId link). AUDITOR only.
  app.patch(
    '/api/v1/audits/:auditId/machine-rooms/:roomId/racks/:rackId/compressors/:compressorId',
    {
      preHandler: requireRole([UserRole.AUDITOR]),
      schema: fastifySchemaFromZod({
        tags: ['compressors'],
        summary: 'Auto-save compressor data. AUDITOR only; must own DRAFT audit. Story 3.3.',
        params: compressorItemParamsSchema,
        body: patchCompressorBodySchema,
        response: {
          200: patchCompressorResponseSchema,
          401: problemDetailSchema,
          403: problemDetailSchema,
          404: problemDetailSchema,
          422: problemDetailSchema,
        },
      }),
    },
    async (request, reply) => {
      const p = request.params as CompressorItemParams
      const body = request.body as PatchCompressorBody
      const result = await compressorService.patchCompressor(
        { compressorId: p.compressorId, rackId: p.rackId, machineRoomId: p.roomId, auditId: p.auditId, body },
        { request },
      )
      return reply.code(200).send(result)
    },
  )

  // POST — duplicate a compressor (copies data minus serialNumber). AUDITOR only.
  app.post(
    '/api/v1/audits/:auditId/machine-rooms/:roomId/racks/:rackId/compressors/:compressorId/duplicate',
    {
      preHandler: requireRole([UserRole.AUDITOR]),
      schema: fastifySchemaFromZod({
        tags: ['compressors'],
        summary: 'Duplicate a compressor, clearing its serial number. AUDITOR only. Story 3.3.',
        params: compressorItemParamsSchema,
        body: emptyBodySchema,
        response: {
          200: duplicateCompressorResponseSchema,
          401: problemDetailSchema,
          403: problemDetailSchema,
          404: problemDetailSchema,
          422: problemDetailSchema,
        },
      }),
    },
    async (request, reply) => {
      const p = request.params as CompressorItemParams
      const result = await compressorService.duplicateCompressor(
        { compressorId: p.compressorId, rackId: p.rackId, machineRoomId: p.roomId, auditId: p.auditId },
        { request },
      )
      return reply.code(200).send(result)
    },
  )

  // POST — FR53: alert tenant Admins that the model is not in the regression DB. AUDITOR only.
  app.post(
    '/api/v1/audits/:auditId/machine-rooms/:roomId/racks/:rackId/compressors/:compressorId/report-unknown-model',
    {
      preHandler: requireRole([UserRole.AUDITOR]),
      schema: fastifySchemaFromZod({
        tags: ['compressors'],
        summary: 'Notify Admins of an unknown compressor model (FR53). AUDITOR only. Idempotent. Story 3.3.',
        params: compressorItemParamsSchema,
        body: emptyBodySchema,
        response: {
          200: reportUnknownModelResponseSchema,
          401: problemDetailSchema,
          403: problemDetailSchema,
          404: problemDetailSchema,
        },
      }),
    },
    async (request, reply) => {
      const p = request.params as CompressorItemParams
      const result = await compressorService.reportUnknownModel(
        { compressorId: p.compressorId, rackId: p.rackId, machineRoomId: p.roomId, auditId: p.auditId },
        { request },
      )
      return reply.code(200).send(result)
    },
  )
}
