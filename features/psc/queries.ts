import "server-only";
import { prisma } from "@/lib/prisma";
import { getKpiPeriod, startOfToday } from "@/lib/kpi-period";
import { paginationArgs, paginate } from "@/lib/pagination";
import type { InspectionStatus } from "@/lib/generated/prisma";
import type { PscKpiPeriodKey } from "./schema";

export type PscFilters = { search?: string; status?: InspectionStatus; detained?: boolean; vesselId?: string };

export async function listPsc(companyId: string, filters: PscFilters = {}, page = 1) {
  const where = {
    companyId,
    deletedAt: null,
    status: filters.status,
    detained: filters.detained,
    vesselId: filters.vesselId,
    ...(filters.search
      ? {
          OR: [
            { refNo: { contains: filters.search } },
            { authority: { contains: filters.search } },
          ],
        }
      : {}),
  };

  const [inspections, total] = await Promise.all([
    prisma.pscInspection.findMany({
      where,
      include: {
        vessel: { select: { name: true } },
        deficiencies: { where: { deletedAt: null }, select: { id: true } },
      },
      orderBy: [{ inspectionDate: "desc" }],
      ...paginationArgs(page),
    }),
    prisma.pscInspection.count({ where }),
  ]);

  // Same NCR caveat as Internal Audits: a deficiency raised into an NCR
  // moves its corrective actions off PscDeficiency onto the NCR record, so
  // this rollup only reflects what's still tracked on the deficiency itself.
  const deficiencyIds = inspections.flatMap((i) => i.deficiencies.map((d) => d.id));
  const capaRows = deficiencyIds.length
    ? await prisma.capaAction.findMany({
        where: {
          companyId,
          deletedAt: null,
          entityType: "PscDeficiency",
          entityId: { in: deficiencyIds },
          status: { not: "CLOSED" },
        },
        select: { entityId: true, targetDate: true },
      })
    : [];

  const deficiencyToInsp = new Map<string, string>();
  for (const i of inspections) for (const d of i.deficiencies) deficiencyToInsp.set(d.id, i.id);

  const today = startOfToday();
  const capaPendingByInsp = new Map<string, number>();
  const capaOverdueByInsp = new Map<string, number>();
  for (const row of capaRows) {
    const inspId = deficiencyToInsp.get(row.entityId);
    if (!inspId) continue;
    capaPendingByInsp.set(inspId, (capaPendingByInsp.get(inspId) ?? 0) + 1);
    if (row.targetDate && row.targetDate < today) {
      capaOverdueByInsp.set(inspId, (capaOverdueByInsp.get(inspId) ?? 0) + 1);
    }
  }

  const rows = inspections.map((i) => ({
    ...i,
    deficiencyCount: i.deficiencies.length,
    capaPending: capaPendingByInsp.get(i.id) ?? 0,
    capaOverdue: capaOverdueByInsp.get(i.id) ?? 0,
  }));
  return paginate(rows, total, page);
}

export async function getPsc(companyId: string, id: string, vesselId?: string) {
  const insp = await prisma.pscInspection.findFirst({
    where: { id, companyId, deletedAt: null, vesselId },
    include: {
      vessel: { select: { name: true } },
      deficiencies: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!insp) return null;

  const deficiencyIds = insp.deficiencies.map((d) => d.id);
  const attachments = deficiencyIds.length
    ? await prisma.attachment.findMany({
        where: { companyId, entityType: "PscDeficiency", entityId: { in: deficiencyIds }, deletedAt: null },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return {
    ...insp,
    deficiencies: insp.deficiencies.map((d) => ({
      ...d,
      attachments: attachments.filter((a) => a.entityId === d.id),
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

/** Resolves the PSC KPI dashboard's Period selector to a concrete [from, to]
 * range, always ending today. Rolling 12 Months / YTD route through the
 * shared KPI Period Service (lib/kpi-period.ts) so PSC uses the exact same
 * period math as every other module's KPI dashboard; Yearly (full current
 * calendar year) is PSC-specific — not one of the standard measurement
 * periods — so it stays a bespoke inline range. */
export function resolvePscKpiRange(period: PscKpiPeriodKey): { from: Date; to: Date } {
  const today = startOfToday();
  if (period === "YEARLY") {
    const y = today.getUTCFullYear();
    return { from: new Date(Date.UTC(y, 0, 1)), to: new Date(Date.UTC(y, 11, 31)) };
  }
  const kpiPeriod = getKpiPeriod({ measurementPeriod: period, reportingDate: today });
  return { from: kpiPeriod.periodStart, to: kpiPeriod.periodEnd };
}

export type PscKpiData = {
  totalInspections: number;
  totalDeficiencies: number;
  avgPerInspection: number;
  detainedCount: number;
};

/** PSC KPI dashboard data for a date range: inspection/deficiency counts,
 * average deficiencies per inspection, and how many inspections in the
 * period resulted in a detention. */
export async function pscAnalytics(companyId: string, range: { from: Date; to: Date }, vesselId?: string): Promise<PscKpiData> {
  const inspections = await prisma.pscInspection.findMany({
    where: { companyId, deletedAt: null, ...(vesselId ? { vesselId } : {}), inspectionDate: { gte: range.from, lte: range.to } },
    include: { _count: { select: { deficiencies: { where: { deletedAt: null } } } } },
  });

  const totalInspections = inspections.length;
  const totalDeficiencies = inspections.reduce((sum, i) => sum + i._count.deficiencies, 0);
  const detainedCount = inspections.filter((i) => i.detained).length;

  return {
    totalInspections,
    totalDeficiencies,
    avgPerInspection: totalInspections > 0 ? totalDeficiencies / totalInspections : 0,
    detainedCount,
  };
}
