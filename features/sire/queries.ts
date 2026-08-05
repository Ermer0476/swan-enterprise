import "server-only";
import { prisma } from "@/lib/prisma";
import type { InspectionStatus } from "@/lib/generated/prisma";

export type SireFilters = { search?: string; status?: InspectionStatus };

export async function listSire(companyId: string, filters: SireFilters = {}) {
  return prisma.sireInspection.findMany({
    where: {
      companyId,
      deletedAt: null,
      status: filters.status,
      ...(filters.search
        ? {
            OR: [
              { refNo: { contains: filters.search } },
              { inspectingCompany: { contains: filters.search } },
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

export async function getSire(companyId: string, id: string) {
  const insp = await prisma.sireInspection.findFirst({
    where: { id, companyId, deletedAt: null },
    include: {
      vessel: { select: { name: true } },
      observations: {
        where: { deletedAt: null },
        include: {
          responsiblePerson: { select: { fullName: true } },
          verifiedBy: { select: { fullName: true } },
          comments: {
            orderBy: { createdAt: "asc" },
            include: { author: { select: { fullName: true } } },
          },
        },
        orderBy: { seq: "asc" },
      },
    },
  });
  if (!insp) return null;

  const observationIds = insp.observations.map((o) => o.id);
  const attachments = observationIds.length
    ? await prisma.attachment.findMany({
        where: { companyId, entityType: "SireObservation", entityId: { in: observationIds }, deletedAt: null },
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
 * SireInspection.inspectionDate. No year = all time (quarter is ignored in
 * that case, since "just this quarter, no particular year" isn't a
 * meaningful filter). Year with no quarter = the whole year. */
export function resolveSirePeriod(year?: number, quarter?: number): { from?: Date; to?: Date } {
  if (!year) return {};
  if (!quarter || quarter < 1 || quarter > 4) {
    return { from: new Date(year, 0, 1), to: new Date(year + 1, 0, 1) };
  }
  const startMonth = (quarter - 1) * 3;
  return { from: new Date(year, startMonth, 1), to: new Date(year, startMonth + 3, 1) };
}

/** Fleet-wide SIRE KPIs for a date range: average observations per
 * inspection, breakdowns by observation category, root cause (+ sub-cause),
 * and per-vessel totals split by inspecting company ("Oil Major"). Computed
 * in one pass since inspection/observation volumes are small per company. */
export async function sireAnalytics(companyId: string, range: { from?: Date; to?: Date }) {
  const inspections = await prisma.sireInspection.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(range.from || range.to
        ? { inspectionDate: { gte: range.from, lt: range.to } }
        : {}),
    },
    select: {
      id: true,
      inspectingCompany: true,
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
  const byVesselOilMajor: Record<string, Record<string, number>> = {};

  for (const insp of inspections) {
    const vesselName = insp.vessel?.name ?? "Fleet-wide";
    const oilMajor = insp.inspectingCompany || "Unspecified";
    byVesselOilMajor[vesselName] ??= {};
    byVesselOilMajor[vesselName][oilMajor] =
      (byVesselOilMajor[vesselName][oilMajor] ?? 0) + insp.observations.length;

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
    byVesselOilMajor,
  };
}

export async function listVesselOptions(companyId: string) {
  return prisma.vessel.findMany({
    where: { companyId, deletedAt: null, status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function listPersonnelOptions(companyId: string) {
  return prisma.user.findMany({
    where: { companyId, deletedAt: null, active: true },
    select: { id: true, fullName: true, rank: true },
    orderBy: { fullName: "asc" },
  });
}
