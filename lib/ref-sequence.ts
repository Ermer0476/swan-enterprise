import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Atomically allocates the next number for a given prefix (e.g. "DR-2026")
 * and returns the full formatted reference (e.g. "DR-2026-0001"). Backs
 * every module's ref-number generation.
 *
 * A plain `count()` then string-format races under concurrent writes — two
 * submissions at the same instant (e.g. two vessels reporting at once) can
 * both read the same count and both try to create the same refNo, tripping
 * the model's `@@unique([companyId, refNo])` as a hard error on the loser
 * instead of just allocating the next number. `INSERT ... ON CONFLICT DO
 * UPDATE ... RETURNING` is a single atomic row operation in Postgres, so
 * concurrent callers always get distinct, gap-free sequence numbers.
 */
export async function allocateRefNo(companyId: string, prefix: string, pad = 4): Promise<string> {
  const rows = await prisma.$queryRaw<{ seq: number }[]>`
    INSERT INTO "RefSequence" ("companyId", "prefix", "seq")
    VALUES (${companyId}, ${prefix}, 1)
    ON CONFLICT ("companyId", "prefix")
    DO UPDATE SET "seq" = "RefSequence"."seq" + 1
    RETURNING "seq"
  `;
  const seq = rows[0]!.seq;
  return `${prefix}-${String(seq).padStart(pad, "0")}`;
}
