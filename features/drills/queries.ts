import "server-only";
import { prisma } from "@/lib/prisma";
import type { FindingStatus } from "@/lib/generated/prisma";

export type DrillFilters = { search?: string; status?: FindingStatus; scheduleItemId?: string };

export async function listDrills(companyId: string, filters: DrillFilters = {}) {
  return prisma.emergencyDrill.findMany({
    where: {
      companyId,
      deletedAt: null,
      status: filters.status,
      scheduleItemId: filters.scheduleItemId,
      ...(filters.search
        ? {
            OR: [
              { refNo: { contains: filters.search } },
              { conductedBy: { contains: filters.search } },
            ],
          }
        : {}),
    },
    include: { vessel: { select: { name: true } }, scheduleItem: { select: { name: true, itemNo: true } } },
    orderBy: [{ drillDate: "desc" }],
  });
}

export async function getDrill(companyId: string, id: string) {
  return prisma.emergencyDrill.findFirst({
    where: { id, companyId, deletedAt: null },
    include: { vessel: { select: { name: true } }, scheduleItem: true },
  });
}

export async function listVesselOptions(companyId: string) {
  return prisma.vessel.findMany({
    where: { companyId, deletedAt: null, status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
