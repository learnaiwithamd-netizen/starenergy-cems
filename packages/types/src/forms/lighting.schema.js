import { z } from 'zod';
export const lightingSectionSchema = z.object({
    fixtureCount: z.number().int().nonnegative().optional(),
});
//# sourceMappingURL=lighting.schema.js.map