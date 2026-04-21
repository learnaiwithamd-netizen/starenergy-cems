import { z } from 'zod'

export const refrigerationSectionSchema = z.object({
  machineRoomCount: z.number().int().nonnegative().optional(),
})

export type RefrigerationSectionData = z.infer<typeof refrigerationSectionSchema>
