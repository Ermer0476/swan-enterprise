import "server-only";
import { prisma } from "@/lib/prisma";
import {
  REFERENCE_REGISTRY,
  type ReferenceListKey,
  type ReferenceOption,
} from "@/lib/reference-registry";

/**
 * The controlled options for one company's reference list. Reads the active,
 * non-deleted ReferenceListItem rows for the key, ordered by sortOrder then
 * value. When the company has ZERO rows, returns the registry's built-in
 * fallback verbatim — so a picker renders the identical options it did while
 * the list was a hard-coded constant. Pure read; never writes.
 */
export async function getReferenceList(
  companyId: string,
  listKey: ReferenceListKey,
): Promise<ReferenceOption[]> {
  const rows = await prisma.referenceListItem.findMany({
    where: { companyId, listKey, active: true, deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { value: "asc" }],
    select: { value: true, label: true, sortOrder: true },
  });
  if (rows.length === 0) return REFERENCE_REGISTRY[listKey].fallback;
  return rows;
}

/**
 * The set of active values for one company's reference list — for validating
 * that a submitted value is currently a live option. Falls back to the
 * registry values when the company has no rows, mirroring getReferenceList.
 * Pure read; never writes.
 */
export async function getReferenceListValues(
  companyId: string,
  listKey: ReferenceListKey,
): Promise<Set<string>> {
  const options = await getReferenceList(companyId, listKey);
  return new Set(options.map((o) => o.value));
}
