import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Always use minimal logging to avoid memory issues in dev
const prismaClient = globalForPrisma.prisma ?? new PrismaClient({ log: ['error', 'warn'] })

// Avoid creating new PrismaClient on every hot reload in dev, and on every
// serverless invocation in production (Vercel reuses the global between invokes).
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prismaClient
}

export const db = prismaClient
