import "server-only";
import { prisma } from "@/lib/prisma";
import type { InspectionStatus } from "@/lib/generated/prisma";

export type CdiFilters = { search?: string; status?: InspectionStatus };

export async function listCdi(companyId: string, filters: CdiFilters = {}) {
  return prisma.cdiInspection.findMany({
    where: {
      companyId,
      deletedAt: null,
      status: filters.status,
      ...(filters.search
        ? {
            OR: [
              { refNo: { contains: filters.search } },
              { inspectorName: { contains: filters.search } },
            ],
          }
        : {}),
    },
    include: {
      vessel: { select: { name: true } },
      _count: { select: { observations: { where: { deletedAt: null } } } },
    },
    orderBy: [{ inspectionDate: "desc" }],
  });
}

export async function getCdi(companyId: string, id: string) {
  const insp = await prisma.cdiInspection.findFirst({
    where: { id, companyId, deletedAt: null },
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

/** Resolve an (optional) year + quarter to a date range for filtering
 * CdiInspection.inspectionDate. No year = all time (quarter is ignored in
 * that case too). Year with no quarter = the whole year. */
export function resolveCdiPeriod(year?: number, quarter?: number): { from?: Date; to?: Date } {
  if (!year) return {};
  if (!quarter || quarter < 1 || quarter > 4) {
    return { from: new Date(year, 0, 1), to: new Date(year + 1, 0, 1) };
  }
  const startMonth = (quarter - 1) * 3;
  return { from: new Date(year, startMonth, 1), to: new Date(year, startMonth + 3, 1) };
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
        ? { inspectionDate: { gte: range.from, lt: range.to } }
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
        if (obs.rootCauseSubCategory) {
          const key = `${obs.rootCauseCategory}::${obs.rootCauseSubCategory}`;
          bySubRootCause[key] ??= {
            category: obs.rootCauseCategory,
            subCategory: obs.rootCauseSubCategory,
            count: 0,
          };
          bySubRootCause[key]!.count += 1;
        }
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
