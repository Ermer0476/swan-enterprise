import "server-only";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CINSP_OBSERVATION_TARGET } from "./schema";
import { startOfToday } from "@/lib/kpi-period";
import { paginationArgs, paginate } from "@/lib/pagination";
import type { InspectionStatus, CompanyInspectionType } from "@/lib/generated/prisma";

export type CompanyInspectionFilters = {
  search?: string;
  status?: InspectionStatus;
  inspectionType?: CompanyInspectionType;
  vesselId?: string;
};

/** Each list row carries `obsClosed`/`obsTotal` — an observation counts as
 * closed once it has no open CAPA rows left (many close without ever having
 * one, since findings can be resolved on the spot via Immediate Corrective
 * Action — see closeCompanyInspectionAction). */
export async function listCompanyInspections(
  companyId: string,
  filters: CompanyInspectionFilters = {},
  page = 1,
) {
  const where = {
    companyId,
    deletedAt: null,
    status: filters.status,
    inspectionType: filters.inspectionType,
    vesselId: filters.vesselId,
    ...(filters.search
      ? {
          OR: [
            { refNo: { contains: filters.search } },
            { inspectorName: { contains: filters.search } },
            { port: { contains: filters.search } },
          ],
        }
      : {}),
  };

  const [inspections, total] = await Promise.all([
    prisma.companyInspection.findMany({
      where,
      include: {
        vessel: { select: { name: true } },
        observations: { where: { deletedAt: null }, select: { id: true } },
      },
      orderBy: [{ inspectionDate: "desc" }],
      ...paginationArgs(page),
    }),
    prisma.companyInspection.count({ where }),
  ]);

  const observationIds = inspections.flatMap((i) => i.observations.map((o) => o.id));
  const capaRows = observationIds.length
    ? await prisma.capaAction.findMany({
        where: {
          companyId,
          deletedAt: null,
          entityType: "CompanyInspectionObservation",
          entityId: { in: observationIds },
          status: { not: "CLOSED" },
        },
        select: { entityId: true, targetDate: true },
      })
    : [];
  const openCapaByObservation = new Set(capaRows.map((c) => c.entityId));

  const obsToInspection = new Map<string, string>();
  for (const insp of inspections) {
    for (const o of insp.observations) obsToInspection.set(o.id, insp.id);
  }
  const today = startOfToday();
  const capaPendingByInsp = new Map<string, number>();
  const capaOverdueByInsp = new Map<string, number>();
  for (const row of capaRows) {
    const inspId = obsToInspection.get(row.entityId);
    if (!inspId) continue;
    capaPendingByInsp.set(inspId, (capaPendingByInsp.get(inspId) ?? 0) + 1);
    if (row.targetDate && row.targetDate < today) {
      capaOverdueByInsp.set(inspId, (capaOverdueByInsp.get(inspId) ?? 0) + 1);
    }
  }

  const rows = inspections.map((insp) => {
    const obsClosed = insp.observations.filter((o) => !openCapaByObservation.has(o.id)).length;
    return {
      ...insp,
      obsClosed,
      obsTotal: insp.observations.length,
      capaPending: capaPendingByInsp.get(insp.id) ?? 0,
      capaOverdue: capaOverdueByInsp.get(insp.id) ?? 0,
    };
  });
  return paginate(rows, total, page);
}

export async function getCompanyInspection(
  companyId: string,
  id: string,
  isShipboard = false,
  vesselId?: string | null,
) {
  const inspection = await prisma.companyInspection.findFirst({
    where: {
      id,
      companyId,
      deletedAt: null,
      ...(isShipboard ? { vesselId: vesselId ?? "__no-vessel-assigned__" } : {}),
    },
    include: {
      vessel: { select: { name: true } },
      observations: { where: { deletedAt: null }, orderBy: { seq: "asc" } },
    },
  });
  if (!inspection) return null;

  const observationIds = inspection.observations.map((o) => o.id);
  const attachments = observationIds.length
    ? await prisma.attachment.findMany({
        where: { companyId, entityType: "CompanyInspectionObservation", entityId: { in: observationIds }, deletedAt: null },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return {
    ...inspection,
    observations: inspection.observations.map((o) => ({
      ...o,
      attachments: attachments.filter((a) => a.entityId === o.id),
    })),
  };
}

/** Fleet-wide Company Inspection KPIs for a date range — mirrors
 * features/sire/queries.ts sireAnalytics exactly, since both feed the same
 * KPI page layout. Company Inspections have no "inspecting company" field
 * like SIRE's oil major, so the per-vessel breakdown splits by
 * inspectionType (Technical / Safety) instead — more useful here than the
 * per-inspector split, since it's the same classification the module's own
 * list/detail pages already surface. */
export async function companyInspectionAnalytics(companyId: string, range: { from?: Date; to?: Date }) {
  const inspections = await prisma.companyInspection.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(range.from || range.to
        ? { inspectionDate: { gte: range.from, lte: range.to } }
        : {}),
    },
    select: {
      id: true,
      inspectionType: true,
      vessel: { select: { id: true, name: true } },
      observations: {
        where: { deletedAt: null },
        select: { category: true, rootCauseCategory: true, rootCauseSubCategory: true, chapter: true },
      },
    },
  });

  const totalInspections = inspections.length;
  const totalObservations = inspections.reduce((sum, i) => sum + i.observations.length, 0);

  const byCategory: Record<string, number> = {};
  const byRootCause: Record<string, number> = {};
  const bySubRootCause: Record<string, { category: string; subCategory: string; count: number }> = {};
  const byVesselInspectionType: Record<string, Record<string, number>> = {};
  // Keyed by VIQ chapter number (1-12) — zero-filled by the caller from
  // VIQ_CHAPTERS so the chart always shows all 12 chapters.
  const byChapter: Record<number, number> = {};

  for (const insp of inspections) {
    const vesselName = insp.vessel?.name ?? "Shore / office";
    const type = insp.inspectionType
      ? insp.inspectionType.charAt(0) + insp.inspectionType.slice(1).toLowerCase()
      : "Unspecified";
    byVesselInspectionType[vesselName] ??= {};
    byVesselInspectionType[vesselName][type] =
      (byVesselInspectionType[vesselName][type] ?? 0) + insp.observations.length;

    for (const obs of insp.observations) {
      const cat = obs.category ?? "UNSPECIFIED";
      byCategory[cat] = (byCategory[cat] ?? 0) + 1;

      if (obs.chapter) {
        byChapter[obs.chapter] = (byChapter[obs.chapter] ?? 0) + 1;
      }

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
    byVesselInspectionType,
    byChapter,
  };
}

export async function getCinspKpiTargets(companyId: string): Promise<{ avgObservationTarget: number }> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { cinspAvgObservationTarget: true },
  });
  return { avgObservationTarget: company?.cinspAvgObservationTarget ?? DEFAULT_CINSP_OBSERVATION_TARGET };
}

export async function listVesselOptions(companyId: string) {
  return prisma.vessel.findMany({
    where: { companyId, deletedAt: null, status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
