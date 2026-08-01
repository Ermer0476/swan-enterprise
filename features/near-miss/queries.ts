import "server-only";
import { prisma } from "@/lib/prisma";
import type { NearMissStatus, Severity } from "@/lib/generated/prisma";

export type NearMissFilters = {
  search?: string;
  status?: NearMissStatus;
  potentialSeverity?: Severity;
};

export async function listNearMisses(
  companyId: string,
  filters: NearMissFilters = {},
) {
  return prisma.nearMiss.findMany({
    where: {
      companyId,
      deletedAt: null,
      status: filters.status,
      potentialSeverity: filters.potentialSeverity,
      ...(filters.search
        ? {
            OR: [
              { refNo: { contains: filters.search } },
              { title: { contains: filters.search } },
            ],
          }
        : {}),
    },
    include: {
      vessel: { select: { name: true } },
      reportedBy: { select: { fullName: true } },
    },
    orderBy: [{ occurredAt: "desc" }],
  });
}

export async function getNearMiss(companyId: string, id: string) {
  return prisma.nearMiss.findFirst({
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
