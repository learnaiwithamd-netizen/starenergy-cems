#!/usr/bin/env node
/**
 * compare-zod-shape.mjs — fails the PR if the calc-service Pydantic models
 * (source of truth) drift from the hand-authored Zod mirrors.
 *
 * Usage: node scripts/compare-zod-shape.mjs <openapi.json path> <zod-schemas.ts path>
 *
 * Approach: parse OpenAPI's `components.schemas` to learn each Pydantic model's
 * required-field set + per-field type. Parse the Zod source to learn each
 * `z.object({...}).$VAR` block's field set. Compare per schema, emit GitHub
 * `::error::` markers and exit non-zero on drift.
 *
 * Rationale: a true semantic diff between Pydantic and Zod is a research
 * project. We instead enforce the *cheap* invariant: "every Pydantic model
 * field MUST appear as a key in the matching Zod object schema" (and vice
 * versa). Type compatibility is left to humans — but a missing field is
 * caught instantly.
 */

import { readFile } from 'node:fs/promises'

const [, , openapiPath, zodPath] = process.argv
if (!openapiPath || !zodPath) {
  console.error('usage: compare-zod-shape.mjs <openapi.json> <calc-service-schemas.ts>')
  process.exit(2)
}

// Pydantic-model → Zod-schema name mapping. Add new entries here when the
// calc-service ships a new model.
const PARITY_MAP = {
  EcmRequest: 'ecmRequestSchema',
  EcmResponse: 'ecmResponseSchema',
  EcmLineItem: 'ecmLineItemSchema',
  CompressorSpec: 'compressorSpecSchema',
  WeatherCoeffs: 'weatherCoeffsSchema',
  BaselineRequest: 'baselineRequestSchema',
  BaselineResponse: 'baselineResponseSchema',
  BaselineCoeffs: 'baselineCoeffsSchema',
  MonthlyReading: 'monthlyReadingSchema',
  DegreeDay: 'degreeDaySchema',
  RefrigerantRequest: 'refrigerantRequestSchema',
  RefrigerantResponse: 'refrigerantResponseSchema',
}

const openapi = JSON.parse(await readFile(openapiPath, 'utf8'))
const zodSrc = await readFile(zodPath, 'utf8')

const issues = []

// Reverse audit: every Pydantic model present in the live OpenAPI MUST be
// represented in PARITY_MAP. Without this check, a new model added to
// `apps/calc-service/app/models/` without a Zod mirror would silently pass
// the parity job — defeating the purpose of the gate.
const KNOWN_PYDANTIC_NOISE = new Set([
  // FastAPI auto-generates these for the OpenAPI doc; not real models.
  'HTTPValidationError',
  'ValidationError',
])
const openapiSchemaNames = Object.keys(openapi.components?.schemas ?? {})
const mappedPydantic = new Set(Object.keys(PARITY_MAP))
for (const name of openapiSchemaNames) {
  if (KNOWN_PYDANTIC_NOISE.has(name)) continue
  if (!mappedPydantic.has(name)) {
    issues.push({
      schema: '(unmapped)',
      kind: 'pydantic-not-in-parity-map',
      detail: `Pydantic model '${name}' has no PARITY_MAP entry. Add '${name}: <zod-schema-name>' to PARITY_MAP and create the matching Zod mirror in apps/api/src/lib/calc-service-schemas.ts.`,
    })
  }
}

for (const [modelName, schemaName] of Object.entries(PARITY_MAP)) {
  const pyModel = openapi.components?.schemas?.[modelName]
  if (!pyModel) {
    issues.push({
      schema: schemaName,
      kind: 'pydantic-missing',
      detail: `OpenAPI has no schema named '${modelName}'. Either remove it from PARITY_MAP or fix the Pydantic model name.`,
    })
    continue
  }

  // Locate `export const <schemaName> = z.object({ ... })` in the Zod file.
  // Uses a simple state machine that counts braces — robust enough for the
  // hand-authored file (avoids pulling in a TS AST dep at lint time).
  const startMarker = new RegExp(`export\\s+const\\s+${schemaName}\\s*=\\s*z\\.object\\s*\\(\\s*\\{`)
  const startMatch = startMarker.exec(zodSrc)
  if (!startMatch) {
    issues.push({
      schema: schemaName,
      kind: 'zod-missing',
      detail: `No 'export const ${schemaName} = z.object({...})' found in the Zod mirror.`,
    })
    continue
  }

  let depth = 1
  let i = startMatch.index + startMatch[0].length
  const openBrace = i
  while (i < zodSrc.length && depth > 0) {
    const ch = zodSrc[i]
    if (ch === '{') depth += 1
    else if (ch === '}') depth -= 1
    i += 1
  }
  if (depth !== 0) {
    issues.push({
      schema: schemaName,
      kind: 'parse-error',
      detail: `Unbalanced braces parsing '${schemaName}'.`,
    })
    continue
  }
  const body = zodSrc.slice(openBrace, i - 1)

  // Each top-level field key in the Zod object: line starts with `<key>:`.
  // Nested z.object braces are inside the parenthesised body of the key,
  // so a depth-aware scan over commas-at-depth-0 yields the field list.
  const zodFields = new Set()
  let d = 0
  let segStart = 0
  for (let j = 0; j <= body.length; j += 1) {
    const ch = body[j]
    if (ch === '(' || ch === '[' || ch === '{') d += 1
    else if (ch === ')' || ch === ']' || ch === '}') d -= 1
    if ((ch === ',' && d === 0) || j === body.length) {
      const seg = body.slice(segStart, j).trim()
      const m = /^([a-z_][a-z0-9_]*)\s*:/i.exec(seg)
      if (m) zodFields.add(m[1])
      segStart = j + 1
    }
  }

  const pyFields = new Set(Object.keys(pyModel.properties ?? {}))

  const inPyOnly = [...pyFields].filter((f) => !zodFields.has(f))
  const inZodOnly = [...zodFields].filter((f) => !pyFields.has(f))

  for (const f of inPyOnly) {
    issues.push({
      schema: schemaName,
      kind: 'field-missing-in-zod',
      detail: `Pydantic model ${modelName} has field '${f}' that the Zod mirror ${schemaName} does not.`,
    })
  }
  for (const f of inZodOnly) {
    issues.push({
      schema: schemaName,
      kind: 'field-missing-in-pydantic',
      detail: `Zod mirror ${schemaName} has field '${f}' that the Pydantic model ${modelName} does not.`,
    })
  }
}

if (issues.length === 0) {
  console.log(`Pydantic ↔ Zod parity OK across ${Object.keys(PARITY_MAP).length} schemas.`)
  process.exit(0)
}

console.log('::group::Pydantic ↔ Zod schema drift')
for (const issue of issues) {
  // Emit a GitHub Actions `::error::` annotation so the PR view highlights
  // each individual drift point.
  console.log(`::error file=${zodPath},title=Schema drift::[${issue.kind}] ${issue.schema}: ${issue.detail}`)
}
console.log('::endgroup::')
console.error(`\n${issues.length} drift issue(s) found between Pydantic and Zod schemas.`)
process.exit(1)
