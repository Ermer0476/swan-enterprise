import "server-only";
import { prisma } from "@/lib/prisma";
import type { NcrStatus, NcrSource } from "@/lib/generated/prisma";

export type NcrFilters = {
  search?: string;
  status?: NcrStatus;
  source?: NcrSource;
};

export async function listNcrs(companyId: string, filters: NcrFilters = {}) {
  return prisma.nonConformity.findMany({
    where: {
      companyId,
      deletedAt: null,
      status: filters.status,
      source: filters.source,
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
      raisedBy: { select: { fullName: true } },
    },
    orderBy: [{ raisedAt: "desc" }],
  });
}

export async function getNcr(companyId: string, id: string) {
  return prisma.nonConformity.findFirst({
    where: { id, companyId, deletedAt: null },
    include: {
      vessel: { select: { name: true } },
      raisedBy: { select: { fullName: true } },
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
