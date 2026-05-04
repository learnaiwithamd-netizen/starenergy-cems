import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { fastifySchemaFromZod, zodToFastifySchema } from './schema.js'

describe('schema helpers', () => {
  it('zodToFastifySchema strips $schema for Fastify Ajv compatibility', () => {
    const json = zodToFastifySchema(z.object({ name: z.string() })) as Record<string, unknown>
    expect(json).not.toHaveProperty('$schema')
    expect(json['type']).toBe('object')
  })

  it('fastifySchemaFromZod produces a Fastify-compatible schema with response codes', () => {
    const fs = fastifySchemaFromZod({
      tags: ['health'],
      summary: 'liveness',
      response: {
        200: z.object({ status: z.literal('ok') }),
      },
    }) as { response: Record<string, { type: string }>; tags: string[] }
    expect(fs.tags).toEqual(['health'])
    expect(fs.response['200']?.type).toBe('object')
  })

  it('fastifySchemaFromZod handles body + querystring + params', () => {
    const fs = fastifySchemaFromZod({
      params: z.object({ id: z.string() }),
      querystring: z.object({ limit: z.number().optional() }),
      body: z.object({ name: z.string() }),
    }) as Record<string, { type: string }>
    expect(fs['params']?.type).toBe('object')
    expect(fs['querystring']?.type).toBe('object')
    expect(fs['body']?.type).toBe('object')
  })
})
