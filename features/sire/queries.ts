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
