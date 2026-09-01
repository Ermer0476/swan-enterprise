import "server-only";
import { prisma } from "@/lib/prisma";
import { resolveSirePeriod } from "@/features/sire/queries";
import { paginationArgs, paginate } from "@/lib/pagination";
import type { NearMissStatus, Severity } from "@/lib/generated/prisma";

// Reused as-is (same cumulative-YTD Year+Quarter math as SIRE/CDI/Company
// Inspections) so Near Miss/HOR's KPI dashboard uses the exact same period
// resolution as every other module's — see lib/kpi-period.ts.
export { resolveSirePeriod as resolveNearMissPeriod };

export type NearMissFilters = {
  search?: string;
  status?: NearMissStatus;
  potentialSeverity?: Severity;
};

/**
 * Drafts are the reporter's own work-in-progress — invisible to everyone
 * else until "Report Near Miss" moves it to REPORTED. Any shipboard user
 * sees every draft fleet-wide (shared vessel logins); an office user only
 * ever sees the drafts *they themselves* raised (pass their own `userId`).
 */
function draftVisibilityClause(isShipboard: boolean, userId?: string) {
  if (isShipboard) return {};
  return {
    OR: [
      { status: "REPORTED" as const },
      { status: "UNDER_REVIEW" as const },
      { status: "CLOSED" as const },
      ...(userId ? [{ status: "DRAFT" as const, createdBy: userId }] : []),
    ],
  };
}

export async function listNearMisses(
  companyId: string,
  filters: NearMissFilters = {},
  isShipboard = false,
  userId?: string,
  vesselId?: string | null,
  page = 1,
) {
  const where = {
    companyId,
    deletedAt: null,
    potentialSeverity: filters.potentialSeverity,
    // AND'd separately (rather than a single `status` key) so a viewer can
    // never bypass the draft gate by explicitly filtering status=DRAFT —
    // both conditions must hold at once.
    AND: [
      filters.status ? { status: filters.status } : {},
      draftVisibilityClause(isShipboard, userId),
      // Shipboard accounts must only ever see their own vessel's near
      // misses — forced here (never from a client-supplied filter). The
      // sentinel guarantees zero rows rather than an accidental fleet-wide
      // match if a shipboard user somehow has no vesselId assigned.
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
    prisma.nearMiss.findMany({
      where,
      include: {
        vessel: { select: { name: true } },
        reportedBy: { select: { fullName: true } },
      },
      orderBy: [{ occurredAt: "desc" }],
      ...paginationArgs(page),
    }),
    prisma.nearMiss.count({ where }),
  ]);
  return paginate(rows, total, page);
}

export async function getNearMiss(
  companyId: string,
  id: string,
  isShipboard = false,
  userId?: string,
  vesselId?: string | null,
) {
  return prisma.nearMiss.findFirst({
    where: {
      id,
      companyId,
      deletedAt: null,
      AND: [draftVisibilityClause(isShipboard, userId)],
      ...(isShipboard ? { vesselId: vesselId ?? "__no-vessel-assigned__" } : {}),
    },
    include: {
      vessel: { select: { name: true } },
      reportedBy: { select: { fullName: true } },
      shoreRemarksByUser: { select: { fullName: true, rank: true } },
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

export type ReporterStopAuthorityRow = { reporterName: string; stopAuthorityCount: number; horCount: number };

export type NearMissKpiData = {
  ncCount: number;
  horCount: number;
  stopAuthorityCount: number;
  byConsequence: Record<string, number>;
  byLocation: Record<string, number>;
  reporterLeaderboard: ReporterStopAuthorityRow[];
};

/** Near Miss/HOR KPI dashboard data for a date range: NC vs HOR volume,
 * potential-consequence breakdown, how many HORs had Stop Work Authority
 * exercised, and — since stopAuthorityExercised is only ever recorded
 * against a reporter's typed-in name (see schema.prisma: shared vessel
 * logins mean reportedById doesn't reliably identify who filed it) — a
 * leaderboard of reporters ranked by how many times they've exercised it. */
export async function nearMissAnalytics(
  companyId: string,
  range: { from?: Date; to?: Date },
  vesselId?: string,
): Promise<NearMissKpiData> {
  const rows = await prisma.nearMiss.findMany({
    where: {
      companyId,
      deletedAt: null,
      status: { not: "DRAFT" },
      ...(vesselId ? { vesselId } : {}),
      ...(range.from || range.to ? { occurredAt: { gte: range.from, lte: range.to } } : {}),
    },
    select: {
      kind: true,
      potentialConsequence: true,
      stopAuthorityExercised: true,
      reporterName: true,
      location: true,
    },
  });

  const ncCount = rows.filter((r) => r.kind === "NEAR_MISS").length;
  const horCount = rows.filter((r) => r.kind === "HOR").length;
  const stopAuthorityCount = rows.filter((r) => r.stopAuthorityExercised).length;

  const byConsequence: Record<string, number> = {};
  const byLocation: Record<string, number> = {};
  for (const r of rows) {
    byConsequence[r.potentialConsequence] = (byConsequence[r.potentialConsequence] ?? 0) + 1;
    const loc = r.location || "Unspecified";
    byLocation[loc] = (byLocation[loc] ?? 0) + 1;
  }

  const byReporter = new Map<string, ReporterStopAuthorityRow>();
  for (const r of rows) {
    const reporterName = r.reporterName?.trim();
    if (!reporterName) continue;
    const entry = byReporter.get(reporterName) ?? { reporterName, stopAuthorityCount: 0, horCount: 0 };
    if (r.kind === "HOR") entry.horCount += 1;
    if (r.stopAuthorityExercised) entry.stopAuthorityCount += 1;
    byReporter.set(reporterName, entry);
  }
  const reporterLeaderboard = Array.from(byReporter.values())
    .filter((r) => r.stopAuthorityCount > 0)
    .sort((a, b) => b.stopAuthorityCount - a.stopAuthorityCount);

  return { ncCount, horCount, stopAuthorityCount, byConsequence, byLocation, reporterLeaderboard };
}

/** Reported (not draft) count for the last 30 days vs the 30 days before
 * that — a rising count here is a GOOD sign for a Near Miss/HOR program
 * (more reporting = a healthier near-miss culture), the opposite read from
 * every other safety KPI, so this is deliberately kept as two plain counts
 * rather than a flagged/colored rate. */
export async function getNearMissReportingCounts(
  companyId: string,
  asOf: Date = new Date(),
  vesselId?: string,
): Promise<{ last30: number; previous30: number }> {
  const dayMs = 24 * 60 * 60 * 1000;
  const start30 = new Date(asOf.getTime() - 30 * dayMs);
  const start60 = new Date(asOf.getTime() - 60 * dayMs);

  const [last30, previous30] = await Promise.all([
    prisma.nearMiss.count({
      where: { companyId, deletedAt: null, ...(vesselId ? { vesselId } : {}), status: { not: "DRAFT" }, occurredAt: { gte: start30, lte: asOf } },
    }),
    prisma.nearMiss.count({
      where: { companyId, deletedAt: null, ...(vesselId ? { vesselId } : {}), status: { not: "DRAFT" }, occurredAt: { gte: start60, lt: start30 } },
    }),
  ]);
  return { last30, previous30 };
}
