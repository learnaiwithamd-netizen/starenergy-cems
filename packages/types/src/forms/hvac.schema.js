import { z } from 'zod';
export const hvacSectionSchema = z.object({
    unitCount: z.number().int().nonnegative().optional(),
});
//# sourceMappingURL=hvac.schema.js.map