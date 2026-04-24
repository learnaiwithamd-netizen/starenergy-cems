import { PrismaClient } from '@prisma/client';
export { RlsContextError, withRlsContext } from './middleware/rls.js';
export const prisma = globalThis.__cemsPrisma ?? new PrismaClient();
if (process.env['NODE_ENV'] !== 'production') {
    globalThis.__cemsPrisma = prisma;
}
export { PrismaClient };
//# sourceMappingURL=index.js.map