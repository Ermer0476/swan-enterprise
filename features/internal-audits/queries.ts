import "server-only";
import { prisma } from "@/lib/prisma";
import type { InspectionStatus } from "@/lib/generated/prisma";

export type InternalAuditFilters = { search?: string; status?: InspectionStatus };

export async function listInternalAudits(
  companyId: string,
  filters: InternalAuditFilters = {},
) {
  return prisma.internalAudit.findMany({
    where: {
      companyId,
      deletedAt: null,
      status: filters.status,
      ...(filters.search
        ? {
            OR: [
              { refNo: { contains: filters.search, mode: "insensitive" } },
              { scope: { contains: filters.search, mode: "insensitive" } },
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

export async function getInternalAudit(companyId: string, id: string) {
  return prisma.internalAudit.findFirst({
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
