import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { SignJWT } from 'jose'
import { JWT_AUDIENCE, JWT_ISSUER, UserRole } from '@cems/types'

const { fakeTx, auditServiceMock } = vi.hoisted(() => ({
  fakeTx: Symbol('fake-tx'),
  auditServiceMock: {
    createAuditDraft: vi.fn(),
    listAudits: vi.fn(),
    getAuditDetail: vi.fn(),
    patchAuditSection: vi.fn(),
  },
}))
vi.mock('../services/audit.service.js', () => auditServiceMock)

import { __resetJwtSecretCacheForTests } from '../lib/tokens.js'
import { buildErrorHandler } from '../middleware/error-handler.js'
import { registerAuthHook } from '../middleware/auth.js'
import { registerAuditsRoutes } from './audits.routes.js'

const FAKE_JWT_SECRET = 'unit-test-secret-do-not-use-in-prod-min-32-chars-long'

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(sensible)
  app.setErrorHandler(buildErrorHandler())
  registerAuthHook(app)
  app.decorateRequest('withRls', null as unknown as never)
  app.addHook('preHandler', async (request) => {
    ;(request as unknown as { withRls: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T> }).withRls =
      (fn) => fn(fakeTx)
  })
  registerAuditsRoutes(app)
  return app
}

async function makeToken(role: UserRole, assignedStoreIds: string[] = []): Promise<string> {
  return new SignJWT({ sub: 'user-1', tenantId: 'tenant-a', role, assignedStoreIds })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setSubject('user-1')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(new TextEncoder().encode(FAKE_JWT_SECRET))
}

describe('audits.routes', () => {
  let originalSecret: string | undefined

  beforeAll(() => {
    originalSecret = process.env['JWT_SECRET']
  })

  beforeEach(() => {
    process.env['JWT_SECRET'] = FAKE_JWT_SECRET
    __resetJwtSecretCacheForTests()
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (originalSecret === undefined) delete process.env['JWT_SECRET']
    else process.env['JWT_SECRET'] = originalSecret
    __resetJwtSecretCacheForTests()
  })

  it('200 with empty array when no audits visible', async () => {
    auditServiceMock.listAudits.mockResolvedValue({ audits: [], total: 0 })
    const app = await buildTestApp()
    const token = await makeToken(UserRole.CLIENT, ['store-001'])
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/audits',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ audits: [], total: 0 })
    await app.close()
  })

  it('200 returns the seeded audits for a CLIENT caller', async () => {
    auditServiceMock.listAudits.mockResolvedValue({
      audits: [
        {
          id: 'a-1',
          storeId: 'store-001',
          status: 'DRAFT',
          createdAt: '2026-05-01T00:00:00.000Z',
          updatedAt: '2026-05-02T00:00:00.000Z',
        },
      ],
      total: 1,
    })
    const app = await buildTestApp()
    const token = await makeToken(UserRole.CLIENT, ['store-001'])
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/audits',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.audits).toHaveLength(1)
    expect(body.audits[0].id).toBe('a-1')
    await app.close()
  })

  it('200 — every authenticated role can list (no requireRole)', async () => {
    auditServiceMock.listAudits.mockResolvedValue({ audits: [], total: 0 })
    const app = await buildTestApp()
    for (const role of [UserRole.AUDITOR, UserRole.ADMIN, UserRole.CLIENT] as const) {
      const token = await makeToken(role, role === UserRole.CLIENT ? ['store-001'] : [])
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/audits',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(200)
    }
    await app.close()
  })

  it('401 without an Authorization header', async () => {
    const app = await buildTestApp()
    const res = await app.inject({ method: 'GET', url: '/api/v1/audits' })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('forwards status + auditorId query params to auditService.listAudits (Story 2.3)', async () => {
    auditServiceMock.listAudits.mockResolvedValue({ audits: [], total: 0 })
    const app = await buildTestApp()
    const token = await makeToken(UserRole.AUDITOR)
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/audits?status=DRAFT&auditorId=me',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(auditServiceMock.listAudits).toHaveBeenCalledWith(
      { status: 'DRAFT', auditorId: 'me' },
      expect.objectContaining({ request: expect.anything() }),
    )
    await app.close()
  })

  it('rejects invalid status query value with 422', async () => {
    const app = await buildTestApp()
    const token = await makeToken(UserRole.AUDITOR)
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/audits?status=NOPE',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(422)
    await app.close()
  })
})

describe('POST /api/v1/audits', () => {
  let originalSecret: string | undefined

  beforeAll(() => {
    originalSecret = process.env['JWT_SECRET']
  })

  beforeEach(() => {
    process.env['JWT_SECRET'] = FAKE_JWT_SECRET
    __resetJwtSecretCacheForTests()
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (originalSecret === undefined) delete process.env['JWT_SECRET']
    else process.env['JWT_SECRET'] = originalSecret
    __resetJwtSecretCacheForTests()
  })

  it('201 creates audit for AUDITOR and returns auditId', async () => {
    auditServiceMock.createAuditDraft.mockResolvedValue({ auditId: 'audit-new-1' })
    const app = await buildTestApp()
    const token = await makeToken(UserRole.AUDITOR)
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/audits',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ storeId: 'store-1' }),
    })
    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.body)).toEqual({ auditId: 'audit-new-1' })
    await app.close()
  })

  it('403 for ADMIN caller', async () => {
    const { RoleNotPermittedError } = await import('../lib/auth-errors.js')
    auditServiceMock.createAuditDraft.mockRejectedValue(new RoleNotPermittedError())
    const app = await buildTestApp()
    const token = await makeToken(UserRole.ADMIN)
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/audits',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ storeId: 'store-1' }),
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('403 for CLIENT caller', async () => {
    const { RoleNotPermittedError } = await import('../lib/auth-errors.js')
    auditServiceMock.createAuditDraft.mockRejectedValue(new RoleNotPermittedError())
    const app = await buildTestApp()
    const token = await makeToken(UserRole.CLIENT)
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/audits',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ storeId: 'store-1' }),
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('422 when storeId is missing', async () => {
    const app = await buildTestApp()
    const token = await makeToken(UserRole.AUDITOR)
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/audits',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: JSON.stringify({}),
    })
    expect(res.statusCode).toBe(422)
    await app.close()
  })

  it('401 without an Authorization header', async () => {
    const app = await buildTestApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/audits',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ storeId: 'store-1' }),
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})

describe('GET /api/v1/audits/:id (Story 2.3)', () => {
  let originalSecret: string | undefined

  beforeAll(() => {
    originalSecret = process.env['JWT_SECRET']
  })

  beforeEach(() => {
    process.env['JWT_SECRET'] = FAKE_JWT_SECRET
    __resetJwtSecretCacheForTests()
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (originalSecret === undefined) delete process.env['JWT_SECRET']
    else process.env['JWT_SECRET'] = originalSecret
    __resetJwtSecretCacheForTests()
  })

  it('200 returns audit detail with sections', async () => {
    auditServiceMock.getAuditDetail.mockResolvedValue({
      id: 'audit-1',
      storeId: 'store-001',
      status: 'DRAFT',
      currentSectionId: 'general',
      formVersion: '1.0',
      compressorDbVersion: '2.0',
      createdAt: '2026-05-08T10:00:00.000Z',
      updatedAt: '2026-05-09T10:00:00.000Z',
      sections: [
        {
          sectionId: 'general',
          data: { auditDate: '2026-05-09' },
          completedAt: null,
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
      ],
    })
    const app = await buildTestApp()
    const token = await makeToken(UserRole.AUDITOR)
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/audits/audit-1',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.id).toBe('audit-1')
    expect(body.sections).toHaveLength(1)
    expect(body.sections[0].sectionId).toBe('general')
    expect(body.sections[0].data).toEqual({ auditDate: '2026-05-09' })
    await app.close()
  })

  it('404 when service throws AuditNotFoundError', async () => {
    const { AuditNotFoundError } = await import('../lib/audit-errors.js')
    auditServiceMock.getAuditDetail.mockRejectedValue(new AuditNotFoundError())
    const app = await buildTestApp()
    const token = await makeToken(UserRole.AUDITOR)
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/audits/audit-x',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
    const body = JSON.parse(res.body)
    expect(body.type).toBe('https://cems.starenergy.ca/errors/audit-not-found')
    await app.close()
  })

  it('401 without an Authorization header', async () => {
    const app = await buildTestApp()
    const res = await app.inject({ method: 'GET', url: '/api/v1/audits/audit-1' })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})

describe('PATCH /api/v1/audits/:id/sections/:sectionId (Story 2.3)', () => {
  let originalSecret: string | undefined

  beforeAll(() => {
    originalSecret = process.env['JWT_SECRET']
  })

  beforeEach(() => {
    process.env['JWT_SECRET'] = FAKE_JWT_SECRET
    __resetJwtSecretCacheForTests()
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (originalSecret === undefined) delete process.env['JWT_SECRET']
    else process.env['JWT_SECRET'] = originalSecret
    __resetJwtSecretCacheForTests()
  })

  it('200 returns sectionId + savedAt for AUDITOR happy path', async () => {
    auditServiceMock.patchAuditSection.mockResolvedValue({
      sectionId: 'general',
      savedAt: '2026-05-09T10:00:00.000Z',
    })
    const app = await buildTestApp()
    const token = await makeToken(UserRole.AUDITOR)
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/audits/audit-1/sections/general',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ data: { auditDate: '2026-05-09' } }),
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({
      sectionId: 'general',
      savedAt: '2026-05-09T10:00:00.000Z',
    })
    expect(auditServiceMock.patchAuditSection).toHaveBeenCalledWith(
      { id: 'audit-1', sectionId: 'general' },
      { data: { auditDate: '2026-05-09' } },
      expect.objectContaining({ request: expect.anything() }),
    )
    await app.close()
  })

  it('403 for ADMIN caller', async () => {
    const { RoleNotPermittedError } = await import('../lib/auth-errors.js')
    auditServiceMock.patchAuditSection.mockRejectedValue(new RoleNotPermittedError())
    const app = await buildTestApp()
    const token = await makeToken(UserRole.ADMIN)
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/audits/audit-1/sections/general',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ data: {} }),
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('403 for CLIENT caller', async () => {
    const { RoleNotPermittedError } = await import('../lib/auth-errors.js')
    auditServiceMock.patchAuditSection.mockRejectedValue(new RoleNotPermittedError())
    const app = await buildTestApp()
    const token = await makeToken(UserRole.CLIENT)
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/audits/audit-1/sections/general',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ data: {} }),
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('404 when service throws AuditNotEditableError', async () => {
    const { AuditNotEditableError } = await import('../lib/audit-errors.js')
    auditServiceMock.patchAuditSection.mockRejectedValue(new AuditNotEditableError())
    const app = await buildTestApp()
    const token = await makeToken(UserRole.AUDITOR)
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/audits/audit-1/sections/general',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ data: {} }),
    })
    expect(res.statusCode).toBe(404)
    const body = JSON.parse(res.body)
    expect(body.type).toBe('https://cems.starenergy.ca/errors/audit-not-editable')
    await app.close()
  })

  it('422 when sectionId path param is not in the allowlist', async () => {
    const app = await buildTestApp()
    const token = await makeToken(UserRole.AUDITOR)
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/audits/audit-1/sections/bogus',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ data: {} }),
    })
    expect(res.statusCode).toBe(422)
    await app.close()
  })

  it('422 when body is missing the data property', async () => {
    const app = await buildTestApp()
    const token = await makeToken(UserRole.AUDITOR)
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/audits/audit-1/sections/general',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: JSON.stringify({}),
    })
    expect(res.statusCode).toBe(422)
    await app.close()
  })

  it('401 without an Authorization header', async () => {
    const app = await buildTestApp()
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/audits/audit-1/sections/general',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ data: {} }),
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})
