import { PrismaClient } from '@prisma/client';
import { env, isDevelopment } from '../config/env.js';

export const prisma = new PrismaClient({
  log: isDevelopment ? ['warn', 'error'] : ['error'],
  datasources: {
    db: { url: env.DATABASE_URL },
  },
});
