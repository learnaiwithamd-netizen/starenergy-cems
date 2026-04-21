import { z } from 'zod'

export const lightingSectionSchema = z.object({
  fixtureCount: z.number().int().nonnegative().optional(),
})

export type LightingSectionData = z.infer<typeof lightingSectionSchema>
