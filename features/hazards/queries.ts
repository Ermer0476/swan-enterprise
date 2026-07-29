import "server-only";
import { prisma } from "@/lib/prisma";
import type { HazardStatus, Severity } from "@/lib/generated/prisma";

export type HazardFilters = {
  search?: string;
  status?: HazardStatus;
  riskLevel?: Severity;
};

export async function listHazards(
  companyId: string,
  filters: HazardFilters = {},
) {
  return prisma.hazardObservation.findMany({
    where: {
      companyId,
      deletedAt: null,
      status: filters.status,
      riskLevel: filters.riskLevel,
      ...(filters.search
        ? {
            OR: [
              { refNo: { contains: filters.search, mode: "insensitive" } },
              { title: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      vessel: { select: { name: true } },
      reportedBy: { select: { fullName: true } },
    },
    orderBy: [{ observedAt: "desc" }],
  });
}

export async function getHazard(companyId: string, id: string) {
  return prisma.hazardObservation.findFirst({
    where: { id, companyId, deletedAt: null },
    include: {
      vessel: { select: { name: true } },
      reportedBy: { select: { fullName: true } },
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
