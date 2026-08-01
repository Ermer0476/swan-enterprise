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
  return prisma.cdiInspection.findFirst({
    where: { id, companyId, deletedAt: null },
    include: {
      vessel: { select: { name: true } },
      observations: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
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
