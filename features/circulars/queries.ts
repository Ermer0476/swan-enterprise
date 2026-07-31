import "server-only";
import { prisma } from "@/lib/prisma";
import type { CircularCategory } from "@/lib/generated/prisma";

export type CircularFilters = { search?: string; category?: CircularCategory };

export async function listCirculars(companyId: string, filters: CircularFilters = {}) {
  return prisma.circular.findMany({
    where: {
      companyId,
      deletedAt: null,
      category: filters.category,
      ...(filters.search
        ? {
            OR: [
              { refNo: { contains: filters.search, mode: "insensitive" } },
              { title: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { vessel: { select: { name: true } } },
    orderBy: [{ issueDate: "desc" }],
  });
}

export async function getCircular(companyId: string, id: string) {
  return prisma.circular.findFirst({
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
