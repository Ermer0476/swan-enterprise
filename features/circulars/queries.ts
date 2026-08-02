import "server-only";
import { prisma } from "@/lib/prisma";
import type { CircularCategory, CircularSource } from "@/lib/generated/prisma";

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
};

export async function listCirculars(companyId: string, filters: CircularFilters = {}) {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  return prisma.circular.findMany({
    where: {
      companyId,
      deletedAt: null,
      source: filters.source,
      category: filters.category,
      ...(filters.issuingBody ? { issuingBody: filters.issuingBody } : {}),
      ...(filters.issuingBodyNotIn ? { issuingBody: { notIn: filters.issuingBodyNotIn } } : {}),
      ...(filters.archive ? { issueDate: { lt: oneYearAgo } } : {}),
      // Tier 1 full-text search: title/refNo/issuingBody/body — not just the
      // title, so "maintenance" finds every circular that mentions it
      // anywhere in its content, matching the actual complaint this was
      // built to fix (see COMMENTS_STANDARDIZATION_REPORT-style write-ups
      // this session — nothing was previously searchable but the title).
      ...(filters.search
        ? {
            OR: [
              { refNo: { contains: filters.search } },
              { title: { contains: filters.search } },
              { issuingBody: { contains: filters.search } },
              { body: { contains: filters.search } },
            ],
          }
        : {}),
    },
    include: { vessel: { select: { name: true } } },
    orderBy: filters.archive ? [{ issueDate: "asc" }] : [{ issueDate: "desc" }],
  });
}

export async function getCircular(companyId: string, id: string) {
  return prisma.circular.findFirst({
    where: { id, companyId, deletedAt: null },
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
