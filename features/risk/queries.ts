import "server-only";
import { prisma } from "@/lib/prisma";
import type { RiskAssessmentStatus } from "@/lib/generated/prisma";

export type RiskFilters = { search?: string; status?: RiskAssessmentStatus };

export async function listRiskAssessments(companyId: string, filters: RiskFilters = {}) {
  return prisma.riskAssessment.findMany({
    where: {
      companyId,
      deletedAt: null,
      status: filters.status,
      ...(filters.search
        ? {
            OR: [
              { refNo: { contains: filters.search, mode: "insensitive" } },
              { activity: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { vessel: { select: { name: true } } },
    orderBy: [{ assessmentDate: "desc" }],
  });
}

export async function getRiskAssessment(companyId: string, id: string) {
  return prisma.riskAssessment.findFirst({
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
