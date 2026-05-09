import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  auditDetailSchema,
  type CreateAuditBody,
  createAuditBodySchema,
  createAuditResponseSchema,
  type ListAuditsQuery,
  listAuditsQuerySchema,
  listAuditsResponseSchema,
  type PatchAuditSectionBody,
  type PatchAuditSectionParams,
  patchAuditSectionBodySchema,
  patchAuditSectionParamsSchema,
  patchAuditSectionResponseSchema,
  problemDetailSchema,
  UserRole,
} from '@cems/types'
import { fastifySchemaFromZod } from '../lib/schema.js'
import { requireRole } from '../middleware/role-guard.js'
import * as auditService from '../services/audit.service.js'

export function registerAuditsRoutes(app: FastifyInstance): void {
  // Story 1.4 stub — Story 2.3 added optional status + auditorId query filters.
  app.get(
    '/api/v1/audits',
    {
      schema: fastifySchemaFromZod({
        tags: ['audits'],
        summary: 'List audits visible to the caller (RLS-scoped).',
        querystring: listAuditsQuerySchema,
        response: {
          200: listAuditsResponseSchema,
          401: problemDetailSchema,
        },
      }),
    },
    async (request, reply) => {
      const result = await auditService.listAudits(request.query as ListAuditsQuery, { request })
      return reply.code(200).send(result)
    },
  )

  // Story 2.2 — AUDITOR creates a DRAFT audit and receives the new auditId.
  app.post(
    '/api/v1/audits',
    {
      preHandler: requireRole([UserRole.AUDITOR]),
      schema: fastifySchemaFromZod({
        tags: ['audits'],
        summary: 'Create a new DRAFT audit. AUDITOR role only. Story 2.2.',
        body: createAuditBodySchema,
        response: {
          201: createAuditResponseSchema,
          401: problemDetailSchema,
          403: problemDetailSchema,
        },
      }),
    },
    async (request, reply) => {
      const result = await auditService.createAuditDraft(request.body as CreateAuditBody, { request })
      return reply.code(201).send(result)
    },
  )

  // Story 2.3 — Audit detail incl. all sections (resume pre-fill).
  app.get(
    '/api/v1/audits/:id',
    {
      schema: fastifySchemaFromZod({
        tags: ['audits'],
        summary: 'Get audit detail with all section data. Story 2.3.',
        params: z.object({ id: z.string().min(1) }),
        response: {
          200: auditDetailSchema,
          401: problemDetailSchema,
          404: problemDetailSchema,
        },
      }),
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const result = await auditService.getAuditDetail(id, { request })
      return reply.code(200).send(result)
    },
  )

  // Story 2.3 — auto-save section data (debounced 800 ms from the SPA).
  app.patch(
    '/api/v1/audits/:id/sections/:sectionId',
    {
      preHandler: requireRole([UserRole.AUDITOR]),
      schema: fastifySchemaFromZod({
        tags: ['audits'],
        summary: 'Auto-save a section. AUDITOR role only; must own DRAFT audit. Story 2.3.',
        params: patchAuditSectionParamsSchema,
        body: patchAuditSectionBodySchema,
        response: {
          200: patchAuditSectionResponseSchema,
          401: problemDetailSchema,
          403: problemDetailSchema,
          404: problemDetailSchema,
          422: problemDetailSchema,
        },
      }),
    },
    async (request, reply) => {
      const params = request.params as PatchAuditSectionParams
      const body = request.body as PatchAuditSectionBody
      const result = await auditService.patchAuditSection(params, body, { request })
      return reply.code(200).send(result)
    },
  )
}
