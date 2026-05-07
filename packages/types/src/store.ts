import { z } from 'zod'

/**
 * Minimum store-summary fields the audit-app's StoreSelectorPage needs
 * to render a row. Story 2.2 adds a per-store endpoint with the full
 * reference data (address, manager, service providers, operating hours).
 */
export const storeSummarySchema = z.object({
  id: z.string().min(1),
  storeNumber: z.string().min(1),
  storeName: z.string().nullable(),
  banner: z.string().nullable(),
  region: z.string().nullable(),
})
export type StoreSummary = z.infer<typeof storeSummarySchema>

export const listStoresResponseSchema = z.object({
  stores: z.array(storeSummarySchema),
  total: z.number().int().min(0),
})
export type ListStoresResponse = z.infer<typeof listStoresResponseSchema>

/**
 * Query schema for `GET /api/v1/stores`. `assignedToUser` arrives as a
 * URL string (`'true'`/`'false'`) so we coerce. `search` is accepted but
 * ignored at the API layer in 2.1 — the SPA filters client-side.
 */
export const listStoresQuerySchema = z.object({
  assignedToUser: z.coerce.boolean().default(false),
  search: z.string().max(128).optional(),
})
export type ListStoresQuery = z.infer<typeof listStoresQuerySchema>
