import "server-only";
import { prisma } from "@/lib/prisma";
import type { NcrStatus, NcrSource } from "@/lib/generated/prisma";

export type NcrFilters = {
  search?: string;
  status?: NcrStatus;
  source?: NcrSource;
};

export async function listNcrs(companyId: string, filters: NcrFilters = {}) {
  return prisma.nonConformity.findMany({
    where: {
      companyId,
      deletedAt: null,
      status: filters.status,
      source: filters.source,
      ...(filters.search
        ? {
            OR: [
              { refNo: { contains: filters.search, mode: "insensitive" } },
              { title: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      vessel: { select: { name: true } },
      raisedBy: { select: { fullName: true } },
    },
    orderBy: [{ raisedAt: "desc" }],
  });
}

export async function getNcr(companyId: string, id: string) {
  return prisma.nonConformity.findFirst({
    where: { id, companyId, deletedAt: null },
    include: {
      vessel: { select: { name: true } },
      raisedBy: { select: { fullName: true } },
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

/**
 * Existing NCRs raised from the given source rows (deficiencies/findings),
 * keyed by sourceEntityId — enforces "one finding = one NCR" by letting
 * callers show "View NCR" instead of "Raise NCR" once one exists.
 */
export async function listNcrsBySourceEntityIds(companyId: string, sourceEntityIds: string[]) {
  if (sourceEntityIds.length === 0) return {};
  const rows = await prisma.nonConformity.findMany({
    where: { companyId, sourceEntityId: { in: sourceEntityIds }, deletedAt: null },
    select: { id: true, refNo: true, sourceEntityId: true },
  });
  const map: Record<string, { id: string; refNo: string }> = {};
  for (const r of rows) {
    if (r.sourceEntityId) map[r.sourceEntityId] = { id: r.id, refNo: r.refNo };
  }
  return map;
}

/**
 * Suggested next NCR number (e.g. NCR-2026-0007) — based on the highest
 * existing number for the current year, not just a row count, so an
 * out-of-sequence manually-entered number still advances the suggestion
 * correctly next time. The user may edit this before saving; uniqueness is
 * re-checked server-side in createNcrAction regardless.
 */
export async function suggestNextRefNo(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `NCR-${year}-`;
  const rows = await prisma.nonConformity.findMany({
    where: { companyId, refNo: { startsWith: prefix } },
    select: { refNo: true },
    orderBy: { refNo: "desc" },
    take: 1,
  });
  const last = rows[0]?.refNo;
  const lastNum = last ? parseInt(last.slice(prefix.length), 10) || 0 : 0;
  return `${prefix}${String(lastNum + 1).padStart(4, "0")}`;
}
