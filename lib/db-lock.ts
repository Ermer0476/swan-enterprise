import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma";

/** Runs fn inside a transaction holding a Postgres advisory xact lock keyed by `key`,
 *  serializing concurrent callers that pass the same key. Releases on commit/rollback. */
export async function withAdvisoryLock<T>(
  key: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
    return fn(tx);
  });
}
