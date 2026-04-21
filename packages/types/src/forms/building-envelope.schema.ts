import { z } from 'zod'

export const buildingEnvelopeSectionSchema = z.object({
  wallInsulationRValue: z.number().optional(),
})

export type BuildingEnvelopeSectionData = z.infer<typeof buildingEnvelopeSectionSchema>
