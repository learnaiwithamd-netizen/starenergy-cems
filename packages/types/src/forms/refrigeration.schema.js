import { z } from 'zod';
export const refrigerationSectionSchema = z.object({
    machineRoomCount: z.number().int().nonnegative().optional(),
});
//# sourceMappingURL=refrigeration.schema.js.map