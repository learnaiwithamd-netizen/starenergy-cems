import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { SignJWT } from 'jose'
import { JWT_AUDIENCE, JWT_ISSUER, UserRole } from '@cems/types'

const { fakeTx, compressorServiceMock } = vi.hoisted(() => ({
  fakeTx: Symbol('fake-tx'),
  compressorServiceMock: {
    createCompressor: vi.fn(),
    getCompressors: vi.fn(),
    getCompressorById: vi.fn(),
    patchCompressor: vi.fn(),
    duplicateCompressor: vi.fn(),
    reportUnknownModel: vi.fn(),
    lookupCompressorRef: vi.fn(),
  },
}))
vi.mock('../services/compressor.service.js', () => compressorServiceMock)

import { __resetJwtSecretCacheForTests } from '../lib/tokens.js'
import { buildErrorHandler } from '../middleware/error-handler.js'
import { registerAuthHook } from '../middleware/auth.js'
import { registerCompressorsRoutes } from './compressors.routes.js'
import { CompressorModelNotFoundError, CompressorNotFoundError } from '../lib/audit-errors.js'

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
  registerCompressorsRoutes(app)
  return app
}

async function makeToken(role: UserRole): Promise<string> {
  return new SignJWT({ sub: 'user-1', tenantId: 'tenant-a', role, assignedStoreIds: [] })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setSubject('user-1')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(new TextEncoder().encode(FAKE_JWT_SECRET))
}

const fakeCompressor = {
  id: 'comp-1',
  tenantId: 'tenant-a',
  rackId: 'rack-1',
  compressorNumber: '1',
  compressorRefId: null,
  data: {},
  createdAt: '2026-05-22T10:00:00.000Z',
  updatedAt: '2026-05-22T10:00:00.000Z',
}

const fakeRef = {
  id: 'ref-1',
  compressorDbVersion: '1.0',
  modelNumber: 'ZB45KCE-TFD',
  manufacturer: 'Copeland',
  refrigerantType: 'R-404A',
  regressionCoefficients: { capacity: '45000', eer: '11.2' },
  createdAt: '2026-05-22T10:00:00.000Z',
}

const BASE = '/api/v1/audits/audit-1/machine-rooms/mr-1/racks/rack-1/compressors'

describe('compressors.routes', () => {
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

  describe('GET /api/v1/compressors/:model (lookup)', () => {
    it('401 when no token', async () => {
      const app = await buildTestApp()
      const res = await app.inject({ method: 'GET', url: '/api/v1/compressors/ZB45KCE-TFD' })
      expect(res.statusCode).toBe(401)
      await app.close()
    })

    it('200 returns the matched compressor ref', async () => {
      compressorServiceMock.lookupCompressorRef.mockResolvedValue(fakeRef)
      const app = await buildTestApp()
      const token = await makeToken(UserRole.AUDITOR)

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/compressors/ZB45KCE-TFD',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body)).toMatchObject({ modelNumber: 'ZB45KCE-TFD', manufacturer: 'Copeland' })
      await app.close()
    })

    it('404 when the model is not in the regression DB', async () => {
      compressorServiceMock.lookupCompressorRef.mockRejectedValue(new CompressorModelNotFoundError())
      const app = await buildTestApp()
      const token = await makeToken(UserRole.AUDITOR)

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/compressors/NOPE',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
      await app.close()
    })
  })

  describe('POST /compressors (+ duplicate + report-unknown-model)', () => {
    it('401 when no token', async () => {
      const app = await buildTestApp()
      const res = await app.inject({
        method: 'POST',
        url: BASE,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })
      expect(res.statusCode).toBe(401)
      await app.close()
    })

    it('200 happy path — returns created compressor', async () => {
      compressorServiceMock.createCompressor.mockResolvedValue(fakeCompressor)
      const app = await buildTestApp()
      const token = await makeToken(UserRole.AUDITOR)

      const res = await app.inject({
        method: 'POST',
        url: BASE,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body)).toMatchObject({ id: 'comp-1', rackId: 'rack-1' })
      await app.close()
    })

    it('403 for ADMIN on create', async () => {
      const app = await buildTestApp()
      const token = await makeToken(UserRole.ADMIN)
      const res = await app.inject({
        method: 'POST',
        url: BASE,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })
      expect(res.statusCode).toBe(403)
      await app.close()
    })

    it('200 duplicate — returns the new compressor', async () => {
      compressorServiceMock.duplicateCompressor.mockResolvedValue({ ...fakeCompressor, id: 'comp-2', compressorNumber: '2' })
      const app = await buildTestApp()
      const token = await makeToken(UserRole.AUDITOR)

      const res = await app.inject({
        method: 'POST',
        url: `${BASE}/comp-1/duplicate`,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body)).toMatchObject({ id: 'comp-2' })
      await app.close()
    })

    it('200 report-unknown-model — returns reported flag', async () => {
      compressorServiceMock.reportUnknownModel.mockResolvedValue({ reported: true, adminsNotified: 1 })
      const app = await buildTestApp()
      const token = await makeToken(UserRole.AUDITOR)

      const res = await app.inject({
        method: 'POST',
        url: `${BASE}/comp-1/report-unknown-model`,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body)).toEqual({ reported: true, adminsNotified: 1 })
      await app.close()
    })

    it('403 for ADMIN on report-unknown-model', async () => {
      const app = await buildTestApp()
      const token = await makeToken(UserRole.ADMIN)
      const res = await app.inject({
        method: 'POST',
        url: `${BASE}/comp-1/report-unknown-model`,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })
      expect(res.statusCode).toBe(403)
      await app.close()
    })
  })

  describe('GET /compressors (list + single)', () => {
    it('200 returns compressor list', async () => {
      compressorServiceMock.getCompressors.mockResolvedValue([fakeCompressor])
      const app = await buildTestApp()
      const token = await makeToken(UserRole.CLIENT)

      const res = await app.inject({ method: 'GET', url: BASE, headers: { authorization: `Bearer ${token}` } })

      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body)).toEqual({ compressors: [fakeCompressor] })
      await app.close()
    })

    it('200 returns a single compressor', async () => {
      compressorServiceMock.getCompressorById.mockResolvedValue(fakeCompressor)
      const app = await buildTestApp()
      const token = await makeToken(UserRole.AUDITOR)

      const res = await app.inject({ method: 'GET', url: `${BASE}/comp-1`, headers: { authorization: `Bearer ${token}` } })

      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body)).toMatchObject({ id: 'comp-1' })
      await app.close()
    })

    it('404 when single compressor not found', async () => {
      compressorServiceMock.getCompressorById.mockRejectedValue(new CompressorNotFoundError())
      const app = await buildTestApp()
      const token = await makeToken(UserRole.AUDITOR)

      const res = await app.inject({ method: 'GET', url: `${BASE}/gone`, headers: { authorization: `Bearer ${token}` } })

      expect(res.statusCode).toBe(404)
      await app.close()
    })
  })

  describe('PATCH /compressors/:compressorId', () => {
    it('200 happy path', async () => {
      compressorServiceMock.patchCompressor.mockResolvedValue({ savedAt: '2026-05-22T10:00:00.000Z', compressorId: 'comp-1' })
      const app = await buildTestApp()
      const token = await makeToken(UserRole.AUDITOR)

      const res = await app.inject({
        method: 'PATCH',
        url: `${BASE}/comp-1`,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ data: { general: { modelNumber: 'ZB45' } }, compressorRefId: 'ref-1' }),
      })

      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body)).toMatchObject({ compressorId: 'comp-1' })
      await app.close()
    })

    it('403 for ADMIN', async () => {
      const app = await buildTestApp()
      const token = await makeToken(UserRole.ADMIN)
      const res = await app.inject({
        method: 'PATCH',
        url: `${BASE}/comp-1`,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ data: {} }),
      })
      expect(res.statusCode).toBe(403)
      await app.close()
    })

    it('404 when compressor not found', async () => {
      compressorServiceMock.patchCompressor.mockRejectedValue(new CompressorNotFoundError())
      const app = await buildTestApp()
      const token = await makeToken(UserRole.AUDITOR)

      const res = await app.inject({
        method: 'PATCH',
        url: `${BASE}/gone`,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ data: {} }),
      })

      expect(res.statusCode).toBe(404)
      await app.close()
    })

    it('422 for missing required body field (data)', async () => {
      const app = await buildTestApp()
      const token = await makeToken(UserRole.AUDITOR)

      const res = await app.inject({
        method: 'PATCH',
        url: `${BASE}/comp-1`,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(res.statusCode).toBe(422)
      await app.close()
    })
  })
})
