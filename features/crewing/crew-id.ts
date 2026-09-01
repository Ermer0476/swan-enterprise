/**
 * Crew ID — the seafarer's `crewCode`, now a first-class identity minted by the
 * register rather than a free-text field copied from a manning agent's list.
 *
 * ── THE SHAPE: `YY-NNNN` ──
 * A two-digit ISSUE YEAR, a dash, then a sequence that resets each calendar year
 * and runs per company. This matches the real crew manifest, whose codes look
 * like `96-394` (legacy, three-digit sequence), `24-0653` and `26-0080`
 * (current, four-digit). "26-0042" is the forty-second crew ID this company
 * issued in 2026. The year is the year the ID was ISSUED, not a birth year or a
 * contract year — parseCrewId reads it straight back out, which is what lets
 * mintCrewId scan one year's series without a separate column.
 *
 * Validation tolerates BOTH a three- and a four-digit sequence: three keeps the
 * legacy manifest codes valid, four is what new codes are minted as. Minting
 * always zero-pads to four (`26-0001`).
 *
 * This module is deliberately split from features/shared/ref-no.ts: that helper
 * mints gap-free compliance numbers keyed on a company prefix and a fixed
 * padding width across ~23 registers, and its `withRefNo` retry loop leans on a
 * unique index that Seafarer.crewCode does NOT have (the register is soft-delete
 * + in-action uniqueness, never @@unique — see crewCodeTaken in actions.ts). The
 * crew ID borrows the max-scan idea and nothing else.
 */

import type { Prisma } from "@/lib/generated/prisma";

/** The canonical crew-ID shape: two digits, a dash, then three OR four digits
 *  (three tolerates the legacy manifest, four is what mintCrewId issues). */
export const CREW_ID_RE = /^\d{2}-\d{3,4}$/;

/**
 * The one message shown when a manually entered crew ID is malformed — shared
 * by the create schema (a fresh value) and updateSeafarerAction (a CHANGED
 * value), so both surfaces phrase the rule identically.
 */
export const CREW_ID_FORMAT_MESSAGE =
  "Crew ID must look like 24-0653 (2-digit year, dash, sequence)";

/** True when `v` is exactly a `YY-NNNN` crew ID (3- or 4-digit sequence).
 *  Nothing is trimmed here — callers trim at the schema boundary, and a stray
 *  space is a real mismatch. */
export function isCrewId(v: string): boolean {
  return CREW_ID_RE.test(v);
}

/**
 * Splits a well-formed crew ID into its two-digit issue year and its sequence,
 * or null when it does not match. `year` is the 2-digit value as written
 * (`26-0080` → 26); `seq` is the numeric sequence with any leading zeros
 * stripped (`26-0080` → 80, `96-394` → 394). `parseInt` is safe only BECAUSE
 * the regex has already proven both halves are all-digits — never call it on
 * unvalidated input.
 */
export function parseCrewId(v: string): { year: number; seq: number } | null {
  if (!CREW_ID_RE.test(v)) return null;
  return { year: parseInt(v.slice(0, 2), 10), seq: parseInt(v.slice(3), 10) };
}

/**
 * Reads back every crew ID this company has already issued under `prefix`
 * (`"26-"`). LIVE rows only — a soft-deleted seafarer is invisible to the
 * register, so his number is free to reissue, the same soft-delete + in-action
 * rule crewCodeTaken enforces. The caller supplies this so mintCrewId stays
 * free of any Prisma model name and testable with a plain array.
 */
export type ReadExistingCrewIds = (
  tx: Prisma.TransactionClient,
  companyId: string,
  prefix: string,
) => Promise<(string | null)[]>;

/**
 * Derives the next crew ID for `companyId` in issue-year `year` (a full
 * four-digit year, e.g. 2026): the two-digit year is `year % 100`, the sequence
 * is the highest already issued in that year plus one, zero-padded to FOUR
 * digits → `26-0001`. Modelled on nextRefNo in features/shared/ref-no.ts — an
 * in-memory MAX scan, not `count()+1` (which reissues a used number the moment a
 * gap appears) and not `orderBy desc` (which sorts "10000" before "9999" once
 * the width is exceeded). The row counts here make the scan free.
 *
 * The MAX scan tolerates both legacy three-digit and current four-digit
 * sequences already stored under the same year (parseCrewId strips leading
 * zeros, so `26-0080` and a hypothetical `26-080` both count as 80).
 *
 * ── NOT CONCURRENCY-SAFE ON ITS OWN ──
 * Two callers minting the same year at the same instant both read the same MAX
 * and both return N+1. crewCode carries no unique index (the register is
 * soft-delete + in-action uniqueness, never @@unique), so nothing downstream
 * would catch the collision. The serialisation is a `pg_advisory_xact_lock`
 * taken as the FIRST statement of the enclosing transaction, keyed on
 * (companyId, 'crewId', year); this function MUST be called under it. See
 * createSeafarerAction.
 *
 * A manual `YY-NNNN` value already stored counts toward the MAX for its year, so
 * an auto-issue never lands on a number a clerk typed by hand. Values from
 * another year (or malformed legacy ones) are skipped by the parseCrewId year
 * check.
 */
export async function mintCrewId(
  tx: Prisma.TransactionClient,
  companyId: string,
  year: number,
  readExisting: ReadExistingCrewIds,
): Promise<string> {
  const yy = year % 100;
  const prefix = `${String(yy).padStart(2, "0")}-`;
  const values = await readExisting(tx, companyId, prefix);
  let max = 0;
  for (const v of values) {
    if (!v) continue; // crewCode is nullable
    const parsed = parseCrewId(v);
    if (parsed && parsed.year === yy && parsed.seq > max) max = parsed.seq;
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}
