import "server-only";
import { prisma } from "@/lib/prisma";
import { getKpiPeriod, quarterEndDate } from "@/lib/kpi-period";
import { paginationArgs, paginate } from "@/lib/pagination";
import type { InspectionStatus } from "@/lib/generated/prisma";

export type CdiFilters = { search?: string; status?: InspectionStatus; vesselId?: string };

/**
 * Each row carries `capaClosed`/`capaTotal` — a CDI observation tracks its
 * own corrective-action lifecycle directly (CdiObservation.status: OPEN/
 * CLOSED), unlike PSC/Internal/External Audit findings, which route through
 * the shared CapaAction tracker. So "closed" here means observations whose
 * own status is CLOSED, not a count of CapaAction rows (CDI never creates
 * any — querying that table always returned 0). Mirrors the same fix in
 * features/sire/queries.ts's listSire.
 */
export async function listCdi(companyId: string, filters: CdiFilters = {}, page = 1) {
  const where = {
    companyId,
    deletedAt: null,
    status: filters.status,
    vesselId: filters.vesselId,
    ...(filters.search
      ? {
          OR: [
            { refNo: { contains: filters.search } },
            { inspectorName: { contains: filters.search } },
          ],
        }
      : {}),
  };

  const [inspections, total] = await Promise.all([
    prisma.cdiInspection.findMany({
      where,
      include: {
        vessel: { select: { name: true } },
        observations: { where: { deletedAt: null }, select: { status: true } },
      },
      orderBy: [{ inspectionDate: "desc" }],
      ...paginationArgs(page),
    }),
    prisma.cdiInspection.count({ where }),
  ]);

  const rows = inspections.map((insp) => {
    const capaTotal = insp.observations.length;
    const capaClosed = insp.observations.filter((o) => o.status === "CLOSED").length;
    return { ...insp, obsTotal: capaTotal, capaClosed, capaTotal };
  });
  return paginate(rows, total, page);
}

export async function getCdi(companyId: string, id: string, vesselId?: string) {
  const insp = await prisma.cdiInspection.findFirst({
    where: { id, companyId, deletedAt: null, vesselId },
    include: {
      vessel: { select: { name: true } },
      observations: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!insp) return null;

  const observationIds = insp.observations.map((o) => o.id);
  const attachments = observationIds.length
    ? await prisma.attachment.findMany({
        where: { companyId, entityType: "CdiObservation", entityId: { in: observationIds }, deletedAt: null },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return {
    ...insp,
    observations: insp.observations.map((o) => ({
      ...o,
      attachments: attachments.filter((a) => a.entityId === o.id),
    })),
  };
}

/** Resolve an (optional) year + quarter to an INCLUSIVE date range for
 * filtering CdiInspection.inspectionDate. No year = all time (quarter is
 * ignored in that case too). Year with no quarter = the whole year.
 * Year+quarter uses the shared KPI Period Service with measurementPeriod
 * "YTD" — TMSA/OCIMF cumulative reporting, so Q2 means Jan–Jun, not just
 * Apr–Jun (see lib/kpi-period.ts). */
export function resolveCdiPeriod(year?: number, quarter?: number): { from?: Date; to?: Date } {
  if (!year) return {};
  if (!quarter || quarter < 1 || quarter > 4) {
    return { from: new Date(Date.UTC(year, 0, 1)), to: new Date(Date.UTC(year, 11, 31)) };
  }
  const period = getKpiPeriod({
    measurementPeriod: "YTD",
    reportingDate: quarterEndDate(year, quarter as 1 | 2 | 3 | 4),
  });
  return { from: period.periodStart, to: period.periodEnd };
}

/** Fleet-wide CDI KPIs for a date range — mirrors features/sire/queries.ts
 * sireAnalytics exactly, since both feed the same KPI page layout. CDI has
 * no "inspecting company" field, so inspectorName stands in as the
 * secondary split dimension for the per-vessel breakdown. */
export async function cdiAnalytics(companyId: string, range: { from?: Date; to?: Date }) {
  const inspections = await prisma.cdiInspection.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(range.from || range.to
        ? { inspectionDate: { gte: range.from, lte: range.to } }
        : {}),
    },
    select: {
      id: true,
      inspectorName: true,
      vessel: { select: { id: true, name: true } },
      observations: {
        where: { deletedAt: null },
        select: { category: true, rootCauseCategory: true, rootCauseSubCategory: true },
      },
    },
  });

  const totalInspections = inspections.length;
  const totalObservations = inspections.reduce((sum, i) => sum + i.observations.length, 0);

  const byCategory: Record<string, number> = {};
  const byRootCause: Record<string, number> = {};
  const bySubRootCause: Record<string, { category: string; subCategory: string; count: number }> = {};
  const byVesselInspector: Record<string, Record<string, number>> = {};

  for (const insp of inspections) {
    const vesselName = insp.vessel?.name ?? "Fleet-wide";
    const inspector = insp.inspectorName || "Unspecified";
    byVesselInspector[vesselName] ??= {};
    byVesselInspector[vesselName][inspector] =
      (byVesselInspector[vesselName][inspector] ?? 0) + insp.observations.length;

    for (const obs of insp.observations) {
      const cat = obs.category ?? "UNSPECIFIED";
      byCategory[cat] = (byCategory[cat] ?? 0) + 1;

      if (obs.rootCauseCategory) {
        byRootCause[obs.rootCauseCategory] = (byRootCause[obs.rootCauseCategory] ?? 0) + 1;
        // Bucketed under "" (Unspecified) when the sub-category hasn't been
        // filled in yet, so this always sums to byRootCause[category] — the
        // sub-cause donut's total previously fell short of the bar chart's
        // count whenever a root cause was tagged without its sub-category.
        const subCategory = obs.rootCauseSubCategory ?? "";
        const key = `${obs.rootCauseCategory}::${subCategory}`;
        bySubRootCause[key] ??= {
          category: obs.rootCauseCategory,
          subCategory,
          count: 0,
        };
        bySubRootCause[key]!.count += 1;
      }
    }
  }

  return {
    totalInspections,
    totalObservations,
    avgPerInspection: totalInspections ? totalObservations / totalInspections : 0,
    byCategory,
    byRootCause,
    bySubRootCause: Object.values(bySubRootCause),
    byVesselInspector,
  };
}

export async function listVesselOptions(companyId: string) {
  return prisma.vessel.findMany({
    where: { companyId, deletedAt: null, status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
