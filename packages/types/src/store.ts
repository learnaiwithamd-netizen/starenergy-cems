import { z } from 'zod'

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

// ─── Story 2.2 — full store detail returned by GET /api/v1/stores/:storeNumber ─

export const storeDetailSchema = z.object({
  id: z.string().min(1),
  storeNumber: z.string().min(1),
  storeName: z.string().nullable(),
  address: z.string().nullable(),
  banner: z.string().nullable(),
  region: z.string().nullable(),
  postalCode: z.string().nullable(),
  operatingHours: z.string().nullable(),
  serviceProviders: z.array(z.string()),
  storeManager: z.string().nullable(),
})
export type StoreDetail = z.infer<typeof storeDetailSchema>
