import { z } from 'zod'

export const hvacSectionSchema = z.object({
  unitCount: z.number().int().nonnegative().optional(),
})

export type HvacSectionData = z.infer<typeof hvacSectionSchema>
