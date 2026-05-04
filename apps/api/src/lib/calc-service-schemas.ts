/**
 * Zod schemas mirroring the Pydantic v2 models in
 * apps/calc-service/app/models/{ecm,baseline,refrigerant}.py.
 *
 * PARITY: Pydantic is the source of truth. Any Pydantic model change
 * REQUIRES a matching update here until Story 0.6 wires
 * `openapi-typescript` codegen against the calc-service /openapi.json.
 */

import { z } from 'zod'

// ── ECM ─────────────────────────────────────────────────────────────

export const compressorSpecSchema = z.object({
  compressor_id: z.string().min(1),
  rack_id: z.string().min(1),
  horsepower: z.number().positive(),
  refrigerant_type: z.string().min(1),
})

export const weatherCoeffsSchema = z.object({
  avg_outdoor_temp_f: z.number(),
  cooling_degree_days: z.number().nonnegative(),
  heating_degree_days: z.number().nonnegative(),
})

export const ecmRequestSchema = z.object({
  audit_id: z.string().min(1),
  compressors: z.array(compressorSpecSchema),
  weather_coefficients: weatherCoeffsSchema,
  utility_rate_kwh: z.number().positive(),
  form_version: z.string().min(1),
})

export const ecmLineItemSchema = z.object({
  equipment_type: z.enum(['compressor', 'rack', 'condenser']),
  equipment_id: z.string().min(1),
  measure: z.enum(['floating-suction', 'head-pressure-control']),
  savings_kwh: z.number().nonnegative(),
  savings_dollars: z.number().nonnegative(),
})

export const ecmResponseSchema = z.object({
  audit_id: z.string(),
  total_savings_kwh: z.number().nonnegative(),
  total_savings_dollars: z.number().nonnegative(),
  line_items: z.array(ecmLineItemSchema),
  service_version: z.string(),
  calculated_at: z.string().datetime({ offset: true }),
})

export type EcmRequest = z.infer<typeof ecmRequestSchema>
export type EcmResponse = z.infer<typeof ecmResponseSchema>

// ── Baseline ────────────────────────────────────────────────────────

export const monthlyReadingSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  consumption_kwh: z.number().nonnegative(),
})

export const degreeDaySchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  cdd: z.number().nonnegative(),
  hdd: z.number().nonnegative(),
})

export const baselineRequestSchema = z.object({
  audit_id: z.string().min(1),
  monthly_consumption: z.array(monthlyReadingSchema),
  cdd_hdd_data: z.array(degreeDaySchema),
  regression_method: z
    .enum(['cdd-only', 'hdd-only', 'cdd-hdd'])
    .default('cdd-hdd'),
})

export const baselineCoeffsSchema = z.object({
  intercept: z.number(),
  cdd_slope: z.number(),
  hdd_slope: z.number(),
})

export const baselineResponseSchema = z.object({
  audit_id: z.string(),
  r_squared: z.number().min(0).max(1),
  coefficients: baselineCoeffsSchema,
  predicted_baseline_kwh: z.number().nonnegative(),
  service_version: z.string(),
  calculated_at: z.string().datetime({ offset: true }),
})

export type BaselineRequest = z.infer<typeof baselineRequestSchema>
export type BaselineResponse = z.infer<typeof baselineResponseSchema>

// ── Refrigerant ─────────────────────────────────────────────────────

export const refrigerantTypeSchema = z.enum([
  'R-404A',
  'R-407A',
  'R-448A',
  'R-449A',
  'R-507A',
  'R-22',
])

export const refrigerantRequestSchema = z.object({
  refrigerant_type: refrigerantTypeSchema,
  temperature_f: z.number().min(-100).max(200),
})

export const refrigerantResponseSchema = z.object({
  refrigerant_type: z.string(),
  temperature_f: z.number(),
  pressure_psig: z.number(),
  service_version: z.string(),
  calculated_at: z.string().datetime({ offset: true }),
})

export type RefrigerantRequest = z.infer<typeof refrigerantRequestSchema>
export type RefrigerantResponse = z.infer<typeof refrigerantResponseSchema>
