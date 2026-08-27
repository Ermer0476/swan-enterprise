import "server-only";
import { prisma } from "@/lib/prisma";
import { paginationArgs, paginate } from "@/lib/pagination";
import type { CircularCategory, CircularSource } from "@/lib/generated/prisma";
import { getReferenceList } from "@/lib/reference-list";
import { circularIssuingBodyKey } from "@/lib/reference-registry";
import { CIRCULAR_SOURCES, type CircularSourceValue } from "./schema";

/** Issuing-body suggestions per source for the report form's datalist, read
 * from the office-editable reference list (registry fallback when a company
 * has no rows). Values only — the datalist has no separate label. */
export type IssuingBodySuggestions = Record<CircularSourceValue, string[]>;

export async function getIssuingBodySuggestions(
  companyId: string,
): Promise<IssuingBodySuggestions> {
  const lists = await Promise.all(
    CIRCULAR_SOURCES.map((s) => getReferenceList(companyId, circularIssuingBodyKey(s))),
  );
  return Object.fromEntries(
    CIRCULAR_SOURCES.map((s, i) => [s, (lists[i] ?? []).map((o) => o.value)]),
  ) as IssuingBodySuggestions;
}

export type CircularFilters = {
  search?: string;
  source?: CircularSource;
  category?: CircularCategory;
  /** Exact match — used by the on-page issuing-body tabs (Flag/Class/Insurance). */
  issuingBody?: string;
  /** "Other <source>" tab — anything NOT in that source's known suggestion list. */
  issuingBodyNotIn?: string[];
  /** Archive view — circulars issued more than a year ago, oldest first. No
   * separate archived/status field: "archived" is just "old enough", derived
   * from issueDate, per the reviewed decision to avoid a schema change. */
  archive?: boolean;
  /** Present (even if null) for SHIPBOARD callers — restricts to fleet-wide
   * circulars (vesselId null — see schema comment) plus this vessel's own
   * targeted ones. Omit entirely for OFFICE callers, who see everything the
   * other filters allow. */
  shipboardVesselId?: string | null;
};

export async function listCirculars(companyId: string, filters: CircularFilters = {}, page = 1) {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const where = {
    companyId,
    deletedAt: null,
    source: filters.source,
    category: filters.category,
    ...(filters.issuingBody ? { issuingBody: filters.issuingBody } : {}),
    ...(filters.issuingBodyNotIn ? { issuingBody: { notIn: filters.issuingBodyNotIn } } : {}),
    ...(filters.archive ? { issueDate: { lt: oneYearAgo } } : {}),
    // Two independent OR-clauses (search, vessel scope) can't both be spread
    // as top-level "OR" keys without colliding — AND-wrapping keeps them
    // each free to define their own OR.
    AND: [
      // Tier 1 full-text search: title/refNo/issuingBody/body — not just the
      // title, so "maintenance" finds every circular that mentions it
      // anywhere in its content, matching the actual complaint this was
      // built to fix (see COMMENTS_STANDARDIZATION_REPORT-style write-ups
      // this session — nothing was previously searchable but the title).
      filters.search
        ? {
            OR: [
              { refNo: { contains: filters.search } },
              { title: { contains: filters.search } },
              { issuingBody: { contains: filters.search } },
              { body: { contains: filters.search } },
            ],
          }
        : {},
      filters.shipboardVesselId !== undefined
        ? { OR: [{ vesselId: null }, { vesselId: filters.shipboardVesselId ?? "__no-vessel-assigned__" }] }
        : {},
    ],
  };

  const [rows, total] = await Promise.all([
    prisma.circular.findMany({
      where,
      include: { vessel: { select: { name: true } } },
      orderBy: filters.archive ? [{ issueDate: "asc" }] : [{ issueDate: "desc" }],
      ...paginationArgs(page),
    }),
    prisma.circular.count({ where }),
  ]);
  return paginate(rows, total, page);
}

/** `shipboardVesselId` — pass the caller's vessel id (or null) when the
 * caller is SHIPBOARD to restrict to a fleet-wide circular (vesselId null)
 * or one targeted at this vessel; omit entirely for OFFICE callers. */
export async function getCircular(companyId: string, id: string, shipboardVesselId?: string | null) {
  return prisma.circular.findFirst({
    where: {
      id,
      companyId,
      deletedAt: null,
      ...(shipboardVesselId !== undefined
        ? { OR: [{ vesselId: null }, { vesselId: shipboardVesselId ?? "__no-vessel-assigned__" }] }
        : {}),
    },
    include: {
      vessel: { select: { name: true } },
      acknowledgements: { orderBy: { recipientLabel: "asc" } },
    },
  });
}

export async function listVesselOptions(companyId: string) {
  return prisma.vessel.findMany({
    where: { companyId, deletedAt: null, status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/** Office (non-shipboard) users available to track individually for
 * acknowledgement — e.g. the Superintendent. Shipboard crew are already
 * covered via the per-vessel acknowledgement row, so this list is scoped to
 * the office side only. */
export async function listOfficeUserOptions(companyId: string) {
  return prisma.user.findMany({
    where: { companyId, deletedAt: null, active: true, department: { not: "SHIPBOARD" } },
    select: { id: true, fullName: true, department: true },
    orderBy: { fullName: "asc" },
  });
}
