import "server-only";
import { Prisma } from "@/lib/generated/prisma";

/** Retries fn when it fails with a Prisma P2002 unique-constraint violation, up to
 *  `attempts` times. Non-P2002 errors propagate immediately. Recompute any derived
 *  values (sequence numbers, counts) INSIDE fn so each retry uses fresh data. */
export async function withUniqueRetry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
  throw lastErr;
}
