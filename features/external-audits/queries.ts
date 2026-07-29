import "server-only";
import { prisma } from "@/lib/prisma";
import type { InspectionStatus } from "@/lib/generated/prisma";

export type ExternalAuditFilters = { search?: string; status?: InspectionStatus };

export async function listExternalAudits(
  companyId: string,
  filters: ExternalAuditFilters = {},
) {
  return prisma.externalAudit.findMany({
    where: {
      companyId,
      deletedAt: null,
      status: filters.status,
      ...(filters.search
        ? {
            OR: [
              { refNo: { contains: filters.search, mode: "insensitive" } },
              { scope: { contains: filters.search, mode: "insensitive" } },
              { auditBody: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      vessel: { select: { name: true } },
      _count: { select: { findings: { where: { deletedAt: null } } } },
    },
    orderBy: [{ auditDate: "desc" }],
  });
}

export async function getExternalAudit(companyId: string, id: string) {
  return prisma.externalAudit.findFirst({
    where: { id, companyId, deletedAt: null },
    include: {
      vessel: { select: { name: true } },
      findings: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
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
