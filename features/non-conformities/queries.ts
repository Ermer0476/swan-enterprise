import "server-only";
import { prisma } from "@/lib/prisma";
import { paginationArgs, paginate } from "@/lib/pagination";
import type { NcrStatus, NcrSource } from "@/lib/generated/prisma";

export type NcrFilters = {
  search?: string;
  status?: NcrStatus;
  source?: NcrSource;
};

/**
 * Vessel accounts are shared logins (multiple crew use the same shipboard
 * account), so a shipboard user sees every draft fleet-wide. An office user
 * only sees drafts they themselves created — everyone else's drafts are
 * invisible to them until reported. AND-ed into the caller's where clause,
 * never a bare top-level OR, so a status filter can't be used to bypass it.
 */
function draftVisibilityClause(isShipboard: boolean, userId?: string) {
  if (isShipboard) return {};
  return {
    OR: [
      { status: { not: "DRAFT" as const } },
      ...(userId ? [{ status: "DRAFT" as const, createdBy: userId }] : []),
    ],
  };
}

export async function listNcrs(
  companyId: string,
  filters: NcrFilters = {},
  isShipboard = false,
  userId?: string,
  vesselId?: string | null,
  page = 1,
) {
  const where = {
    companyId,
    deletedAt: null,
    status: filters.status,
    source: filters.source,
    AND: [
      draftVisibilityClause(isShipboard, userId),
      // Shipboard accounts must only ever see their own vessel's NCRs —
      // forced here (never from a client-supplied filter). The sentinel
      // guarantees zero rows rather than an accidental fleet-wide match if a
      // shipboard user somehow has no vesselId assigned.
      isShipboard ? { vesselId: vesselId ?? "__no-vessel-assigned__" } : {},
    ],
    ...(filters.search
      ? {
          OR: [
            { refNo: { contains: filters.search } },
            { title: { contains: filters.search } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.nonConformity.findMany({
      where,
      include: {
        vessel: { select: { name: true } },
        raisedBy: { select: { fullName: true } },
      },
      orderBy: [{ raisedAt: "desc" }],
      ...paginationArgs(page),
    }),
    prisma.nonConformity.count({ where }),
  ]);
  return paginate(rows, total, page);
}

export async function getNcr(
  companyId: string,
  id: string,
  isShipboard = false,
  userId?: string,
  vesselId?: string | null,
) {
  return prisma.nonConformity.findFirst({
    where: {
      id,
      companyId,
      deletedAt: null,
      AND: [draftVisibilityClause(isShipboard, userId)],
      ...(isShipboard ? { vesselId: vesselId ?? "__no-vessel-assigned__" } : {}),
    },
    include: {
      vessel: { select: { name: true } },
      raisedBy: { select: { fullName: true } },
      verifiedByUser: { select: { fullName: true, rank: true } },
      closedByUser: { select: { fullName: true, rank: true } },
    },
  });
}

export async function listVesselOptions(companyId: string) {
  return prisma.vessel.findMany({
    where: { companyId, deletedAt: null, status: "ACTIVE" },
    select: { id: true, name: true, code: true },
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
    // A Draft has no refNo yet — leave it out of the map so its source
    // finding still shows "Raise NCR" rather than a broken "View NCR" link;
    // it naturally starts appearing once the draft is actually reported.
    if (r.sourceEntityId && r.refNo) map[r.sourceEntityId] = { id: r.id, refNo: r.refNo };
  }
  return map;
}

/**
 * Root cause fields for a set of NCRs, keyed by NCR id — used by source
 * modules (e.g. PSC) whose finding already has a linked NCR, so their own
 * page can display/edit the NCR's root cause directly (single source of
 * truth) instead of keeping a separate, driftable copy.
 */
export async function listNcrRootCauses(companyId: string, ncrIds: string[]) {
  if (ncrIds.length === 0) return {};
  const rows = await prisma.nonConformity.findMany({
    where: { companyId, id: { in: ncrIds }, deletedAt: null },
    select: { id: true, rootCauseCategory: true, rootCauseSubCategory: true, rootCause: true, status: true },
  });
  const map: Record<string, { rootCauseCategory: string | null; rootCauseSubCategory: string | null; rootCause: string | null; status: NcrStatus }> = {};
  for (const r of rows) {
    map[r.id] = { rootCauseCategory: r.rootCauseCategory, rootCauseSubCategory: r.rootCauseSubCategory, rootCause: r.rootCause, status: r.status };
  }
  return map;
}

/**
 * Next NCR number for one vessel's own sequence (e.g. SWA-NCR-2026-0007),
 * or the shore-wide sequence when vesselCode is null (NCR-2026-0007). Each
 * vessel keeps its own count — two ships' 7th NCR of the year both read
 * "…-0007" but are prefixed with different fleet codes, so they never
 * collide once everything lands in the office's central NCR register.
 *
 * The highest *numeric* suffix among matching rows is taken, plus one —
 * rows are parsed and compared numerically rather than sorted as strings: a
 * stray non-numeric refNo (typed in back when this field was still
 * editable, or a one-off manual override) would otherwise sort ahead of
 * "0008" alphabetically and derail the count. This is also called directly
 * by createNcrAction — it's the actual assignment, not just a display
 * suggestion, so it must never regress below what's really in use.
 */
export async function suggestNextRefNo(companyId: string, vesselCode: string | null): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = vesselCode ? `${vesselCode}-NCR-${year}-` : `NCR-${year}-`;
  const rows = await prisma.nonConformity.findMany({
    where: { companyId, refNo: { startsWith: prefix } },
    select: { refNo: true },
  });
  let maxNum = 0;
  for (const r of rows) {
    const n = parseInt((r.refNo ?? "").slice(prefix.length), 10);
    if (!Number.isNaN(n) && n > maxNum) maxNum = n;
  }
  return `${prefix}${String(maxNum + 1).padStart(4, "0")}`;
}

/**
 * suggestNextRefNo for every vessel at once (plus the shore-wide bucket,
 * keyed by ""), so the Raise NCR form can show the right preview instantly
 * when the user switches vessels, without a round trip per change.
 */
export async function suggestNextRefNosForVessels(
  companyId: string,
  vessels: { id: string; code: string | null }[],
): Promise<Record<string, string>> {
  const keys = ["", ...vessels.map((v) => v.id)];
  const codes = [null, ...vessels.map((v) => v.code)];
  const values = await Promise.all(codes.map((code) => suggestNextRefNo(companyId, code)));
  const map: Record<string, string> = {};
  keys.forEach((k, i) => {
    map[k] = values[i] ?? "";
  });
  return map;
}
