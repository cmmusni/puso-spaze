// ─────────────────────────────────────────────
// src/config/db.ts
// Prisma client singleton — import this everywhere
// ─────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';

const globalWithPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

// Prevent creating multiple Prisma instances in dev (hot-reload)
export const prisma: PrismaClient =
  globalWithPrisma.prisma ?? new PrismaClient({ log: ['error'] });

if (process.env.NODE_ENV !== 'production') {
  globalWithPrisma.prisma = prisma;
}
