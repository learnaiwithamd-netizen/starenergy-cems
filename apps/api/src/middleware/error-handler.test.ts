import { describe, expect, it } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { z, ZodError } from 'zod'
import { buildErrorHandler } from './error-handler.js'

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(sensible)
  app.setErrorHandler(buildErrorHandler())

  app.get('/throws/notfound', async () => {
    throw app.httpErrors.notFound('audit xyz not found')
  })

  app.get('/throws/zod', async () => {
    z.object({ id: z.string().min(5) }).parse({ id: 'x' })
    return { ok: true }
  })

  app.get('/throws/unhandled', async () => {
    throw new Error('boom — internal detail not for client')
  })

  app.get('/throws/conflict', async () => {
    throw app.httpErrors.conflict('stale write')
  })

  return app
}

describe('global error handler', () => {
  it('translates httpErrors.notFound to RFC 7807 404', async () => {
    const app = await buildTestApp()
    const res = await app.inject({ method: 'GET', url: '/throws/notfound' })
    expect(res.statusCode).toBe(404)
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/)
    const body = JSON.parse(res.body)
    expect(body).toEqual({
      type: 'https://cems.starenergy.ca/errors/not-found',
      title: 'Not Found',
      status: 404,
      detail: 'audit xyz not found',
      instance: '/throws/notfound',
    })
    await app.close()
  })

  it('translates Zod parse error to RFC 7807 422 with errors[]', async () => {
    const app = await buildTestApp()
    const res = await app.inject({ method: 'GET', url: '/throws/zod' })
    expect(res.statusCode).toBe(422)
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/)
    const body = JSON.parse(res.body)
    expect(body.type).toBe('https://cems.starenergy.ca/errors/validation-error')
    expect(body.status).toBe(422)
    expect(body.errors).toBeInstanceOf(Array)
    expect(body.errors.length).toBeGreaterThan(0)
    expect(body.errors[0]).toHaveProperty('field')
    expect(body.errors[0]).toHaveProperty('message')
    await app.close()
  })

  it('hides internal detail from unhandled errors (500)', async () => {
    const app = await buildTestApp()
    const res = await app.inject({ method: 'GET', url: '/throws/unhandled' })
    expect(res.statusCode).toBe(500)
    const body = JSON.parse(res.body)
    expect(body.type).toBe('https://cems.starenergy.ca/errors/internal-error')
    expect(body.detail).toBe('Internal server error')
    expect(body.detail).not.toContain('boom')
    expect(body).not.toHaveProperty('stack')
    await app.close()
  })

  it('translates conflict to 409 with detail preserved', async () => {
    const app = await buildTestApp()
    const res = await app.inject({ method: 'GET', url: '/throws/conflict' })
    expect(res.statusCode).toBe(409)
    const body = JSON.parse(res.body)
    expect(body.type).toBe('https://cems.starenergy.ca/errors/conflict')
    expect(body.detail).toBe('stale write')
    await app.close()
  })

  it('handles ZodError raw (not via @fastify/sensible)', () => {
    const handler = buildErrorHandler()
    const err = new ZodError([
      { code: 'too_small', minimum: 1, type: 'string', inclusive: true, exact: false, path: ['email'], message: 'String must contain at least 1 character(s)' },
    ])
    const sent: { code: number; type: string; payload: unknown } = { code: 0, type: '', payload: null }
    const fakeReply = {
      code(c: number) { sent.code = c; return this },
      type(t: string) { sent.type = t; return this },
      send(payload: unknown) { sent.payload = payload; return this },
    }
    const fakeReq = {
      url: '/x',
      log: { warn: () => {}, error: () => {} },
    }
    handler(err as never, fakeReq as never, fakeReply as never)
    expect(sent.code).toBe(422)
    expect(sent.type).toMatch(/problem\+json/)
    expect((sent.payload as { errors: unknown[] }).errors).toHaveLength(1)
  })
})
