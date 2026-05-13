import { PrismaClient } from '@prisma/client';

// Single shared Prisma client for the API process. Tests mock this module
// via vi.mock('./db.js') so they never touch a real database.
export const prisma = new PrismaClient();
