import "server-only";
import { prisma } from "@/lib/prisma";
import {
  REFERENCE_REGISTRY,
  rootCauseSubcategoryKey,
  type ReferenceListKey,
  type ReferenceOption,
  type RootCauseSubcategoryOptions,
} from "@/lib/reference-registry";
import { ROOT_CAUSE_CATEGORIES } from "@/lib/root-cause";

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

/**
 * Reporter-position options for a report/edit picker — ship ranks for a
 * shipboard reporter, office positions otherwise (the two lists never mix).
 * Reads the department-appropriate office-editable list (registry fallback
 * when the company has no rows). Shared by Incidents and Near Miss.
 */
export async function getReporterPositionOptions(
  companyId: string,
  department: string,
): Promise<ReferenceOption[]> {
  return getReferenceList(
    companyId,
    department === "SHIPBOARD" ? "ship-position" : "office-position",
  );
}

/**
 * Root-cause sub-category options for every category, for a picker whose
 * category selection is reactive (the client indexes this by the chosen
 * category). Reads the office-editable list per category (registry fallback
 * when the company has no rows). Shared by every module that classifies root
 * cause — Incident, Near Miss, NCR, PSC, audits, SIRE, CDI.
 */
export async function getRootCauseSubcategoryOptions(
  companyId: string,
): Promise<RootCauseSubcategoryOptions> {
  const lists = await Promise.all(
    ROOT_CAUSE_CATEGORIES.map((c) => getReferenceList(companyId, rootCauseSubcategoryKey(c))),
  );
  return Object.fromEntries(
    ROOT_CAUSE_CATEGORIES.map((c, i) => [c, lists[i] ?? []]),
  ) as RootCauseSubcategoryOptions;
}
