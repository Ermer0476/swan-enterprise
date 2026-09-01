import "server-only";
import { prisma } from "@/lib/prisma";
import { getKpiPeriod, startOfToday } from "@/lib/kpi-period";
import { paginationArgs, paginate } from "@/lib/pagination";
import type { InspectionStatus } from "@/lib/generated/prisma";
import type { FlaginspKpiPeriodKey } from "./schema";

export type FlagInspectionFilters = { search?: string; status?: InspectionStatus; vesselId?: string };

export async function listFlagInspections(
  companyId: string,
  filters: FlagInspectionFilters = {},
  page = 1,
) {
  const where = {
    companyId,
    deletedAt: null,
    status: filters.status,
    vesselId: filters.vesselId,
    ...(filters.search
      ? {
          OR: [
            { refNo: { contains: filters.search } },
            { scope: { contains: filters.search } },
            { auditBody: { contains: filters.search } },
          ],
        }
      : {}),
  };

  const [audits, total] = await Promise.all([
    prisma.flagInspection.findMany({
      where,
      include: {
        vessel: { select: { name: true } },
        findings: { where: { deletedAt: null }, select: { id: true } },
      },
      orderBy: [{ auditDate: "desc" }],
      ...paginationArgs(page),
    }),
    prisma.flagInspection.count({ where }),
  ]);

  // Same NCR caveat as Internal/External Audits: a finding raised into an NCR
  // moves its corrective actions off FlagInspectionFinding onto the NCR
  // record, so this rollup only reflects what's still tracked on the finding
  // itself.
  const findingIds = audits.flatMap((a) => a.findings.map((f) => f.id));
  const capaRows = findingIds.length
    ? await prisma.capaAction.findMany({
        where: {
          companyId,
          deletedAt: null,
          entityType: "FlagInspectionFinding",
          entityId: { in: findingIds },
          status: { not: "CLOSED" },
        },
        select: { entityId: true, targetDate: true },
      })
    : [];

  const findingToAudit = new Map<string, string>();
  for (const a of audits) for (const f of a.findings) findingToAudit.set(f.id, a.id);

  const today = startOfToday();
  const capaPendingByAudit = new Map<string, number>();
  const capaOverdueByAudit = new Map<string, number>();
  for (const row of capaRows) {
    const auditId = findingToAudit.get(row.entityId);
    if (!auditId) continue;
    capaPendingByAudit.set(auditId, (capaPendingByAudit.get(auditId) ?? 0) + 1);
    if (row.targetDate && row.targetDate < today) {
      capaOverdueByAudit.set(auditId, (capaOverdueByAudit.get(auditId) ?? 0) + 1);
    }
  }

  const rows = audits.map((a) => ({
    ...a,
    findingCount: a.findings.length,
    capaPending: capaPendingByAudit.get(a.id) ?? 0,
    capaOverdue: capaOverdueByAudit.get(a.id) ?? 0,
  }));
  return paginate(rows, total, page);
}

export async function getFlagInspection(companyId: string, id: string, vesselId?: string) {
  const audit = await prisma.flagInspection.findFirst({
    where: { id, companyId, deletedAt: null, vesselId },
    include: {
      vessel: { select: { name: true } },
      findings: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!audit) return null;

  const findingIds = audit.findings.map((f) => f.id);
  const attachments = findingIds.length
    ? await prisma.attachment.findMany({
        where: { companyId, entityType: "FlagInspectionFinding", entityId: { in: findingIds }, deletedAt: null },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return {
    ...audit,
    findings: audit.findings.map((f) => ({
      ...f,
      attachments: attachments.filter((a) => a.entityId === f.id),
    })),
  };
}

export async function listVesselOptions(companyId: string) {
  return prisma.vessel.findMany({
    where: { companyId, deletedAt: null, status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/** Resolves the Flag Inspections KPI dashboard's Period selector to a
 * concrete [from, to] range, always ending today. Rolling 12 Months / YTD
 * route through the shared KPI Period Service (lib/kpi-period.ts); Yearly
 * (full current calendar year) is a bespoke extra, not one of the standard
 * measurement periods. */
export function resolveFlaginspKpiRange(period: FlaginspKpiPeriodKey): { from: Date; to: Date } {
  const today = startOfToday();
  if (period === "YEARLY") {
    const y = today.getUTCFullYear();
    return { from: new Date(Date.UTC(y, 0, 1)), to: new Date(Date.UTC(y, 11, 31)) };
  }
  const kpiPeriod = getKpiPeriod({ measurementPeriod: period, reportingDate: today });
  return { from: kpiPeriod.periodStart, to: kpiPeriod.periodEnd };
}

export type FlaginspKpiData = {
  totalAudits: number;
  totalObservations: number;
  avgPerAudit: number;
};

/** Flag Inspections KPI dashboard data for a date range: inspection count,
 * total findings, and average findings per inspection. */
export async function flaginspAnalytics(
  companyId: string,
  range: { from: Date; to: Date },
  vesselId?: string,
): Promise<FlaginspKpiData> {
  const audits = await prisma.flagInspection.findMany({
    where: {
      companyId,
      deletedAt: null,
      auditDate: { gte: range.from, lte: range.to },
      ...(vesselId ? { vesselId } : {}),
    },
    include: { _count: { select: { findings: { where: { deletedAt: null } } } } },
  });

  const totalAudits = audits.length;
  const totalObservations = audits.reduce((sum, a) => sum + a._count.findings, 0);

  return {
    totalAudits,
    totalObservations,
    avgPerAudit: totalAudits > 0 ? totalObservations / totalAudits : 0,
  };
}

export type FlagInspectionKpiData = {
  totalInspections: number;
  totalObservations: number;
  avgPerInspection: number;
};

/** Feeds the Dashboard's SIRE / PSC / CDI / Flag / Company Inspection
 * comparison — TMSA's "Missed Observation" idea: if the company's own
 * inspections average fewer observations than what external bodies find,
 * that gap is evidence the internal process is missing things the external
 * inspectors are catching. `range` matches the other analytics functions'
 * shape — omit both ends for all-time. Reads the real FlagInspection model
 * directly (no text-matching heuristic — see the older, now-retired
 * flagInspectionAnalytics in features/external-audits/queries.ts). */
export async function flagInspectionAnalytics(
  companyId: string,
  range: { from?: Date; to?: Date } = {},
  vesselId?: string,
): Promise<FlagInspectionKpiData> {
  const audits = await prisma.flagInspection.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(vesselId ? { vesselId } : {}),
      ...(range.from || range.to
        ? { auditDate: { gte: range.from, lte: range.to } }
        : {}),
    },
    include: { _count: { select: { findings: { where: { deletedAt: null } } } } },
  });

  const totalInspections = audits.length;
  const totalObservations = audits.reduce((sum, a) => sum + a._count.findings, 0);

  return {
    totalInspections,
    totalObservations,
    avgPerInspection: totalInspections > 0 ? totalObservations / totalInspections : 0,
  };
}
