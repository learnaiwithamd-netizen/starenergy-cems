import { z } from 'zod'

export const generalSectionSchema = z.object({
  storeNumber: z.string().min(1),
  storeName: z.string().optional(),
  address: z.string().optional(),
  auditDate: z.string().optional(),
  grossAreaSqft: z.number().positive().optional(),
})

export type GeneralSectionData = z.infer<typeof generalSectionSchema>
