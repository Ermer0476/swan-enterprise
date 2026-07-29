import "server-only";
import { prisma } from "@/lib/prisma";
import type { InspectionStatus } from "@/lib/generated/prisma";

export type PscFilters = { search?: string; status?: InspectionStatus; detained?: boolean };

export async function listPsc(companyId: string, filters: PscFilters = {}) {
  return prisma.pscInspection.findMany({
    where: {
      companyId,
      deletedAt: null,
      status: filters.status,
      detained: filters.detained,
      ...(filters.search
        ? {
            OR: [
              { refNo: { contains: filters.search, mode: "insensitive" } },
              { authority: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      vessel: { select: { name: true } },
      _count: { select: { deficiencies: { where: { deletedAt: null } } } },
    },
    orderBy: [{ inspectionDate: "desc" }],
  });
}

export async function getPsc(companyId: string, id: string) {
  return prisma.pscInspection.findFirst({
    where: { id, companyId, deletedAt: null },
    include: {
      vessel: { select: { name: true } },
      deficiencies: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
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
