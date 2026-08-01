import "server-only";
import { prisma } from "@/lib/prisma";
import type { DefectStatus, DefectSeverity } from "@/lib/generated/prisma";

export type DefectFilters = { search?: string; status?: DefectStatus; severity?: DefectSeverity };

export async function listDefects(companyId: string, filters: DefectFilters = {}) {
  return prisma.defect.findMany({
    where: {
      companyId,
      deletedAt: null,
      status: filters.status,
      severity: filters.severity,
      ...(filters.search
        ? {
            OR: [
              { refNo: { contains: filters.search } },
              { equipment: { contains: filters.search } },
            ],
          }
        : {}),
    },
    include: { vessel: { select: { name: true } } },
    orderBy: [{ dateRaised: "desc" }],
  });
}

export async function getDefect(companyId: string, id: string) {
  return prisma.defect.findFirst({
    where: { id, companyId, deletedAt: null },
    include: { vessel: { select: { name: true } } },
  });
}

export async function listVesselOptions(companyId: string) {
  return prisma.vessel.findMany({
    where: { companyId, deletedAt: null, status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
