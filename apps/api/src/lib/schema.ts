import { zodToJsonSchema } from 'zod-to-json-schema'
import type { ZodSchema } from 'zod'
import type { FastifySchema } from 'fastify'

/**
 * Convert a Zod schema to Fastify-compatible JSON Schema.
 * Fastify uses Ajv internally; zod-to-json-schema produces JSON Schema 7
 * (with `$schema` + `$ref`). We strip `$schema` because Fastify's compiler
 * rejects it.
 */
export function zodToFastifySchema(schema: ZodSchema): unknown {
  const json = zodToJsonSchema(schema, { target: 'jsonSchema7', $refStrategy: 'none' }) as Record<string, unknown>
  delete json['$schema']
  return json
}

/**
 * Builds a `FastifySchema` object from a map of Zod schemas keyed by
 * the Fastify schema slot (params, querystring, body, response).
 */
export interface ZodSchemaMap {
  params?: ZodSchema
  querystring?: ZodSchema
  body?: ZodSchema
  response?: Record<number | string, ZodSchema>
  description?: string
  summary?: string
  tags?: string[]
}

export function fastifySchemaFromZod(map: ZodSchemaMap): FastifySchema {
  const out: FastifySchema = {}
  if (map.description) out.description = map.description
  if (map.summary) out.summary = map.summary
  if (map.tags) out.tags = map.tags
  if (map.params) out.params = zodToFastifySchema(map.params) as FastifySchema['params']
  if (map.querystring) out.querystring = zodToFastifySchema(map.querystring) as FastifySchema['querystring']
  if (map.body) out.body = zodToFastifySchema(map.body) as FastifySchema['body']
  if (map.response) {
    out.response = {}
    for (const [code, zodSchema] of Object.entries(map.response)) {
      ;(out.response as Record<string, unknown>)[code] = zodToFastifySchema(zodSchema)
    }
  }
  return out
}
