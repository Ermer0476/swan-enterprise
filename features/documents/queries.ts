import "server-only";
import { prisma } from "@/lib/prisma";
import type { ControlledDocStatus, DocumentCategory } from "@/lib/generated/prisma";

export type DocumentFilters = { search?: string; status?: ControlledDocStatus; category?: DocumentCategory };

export async function listDocuments(companyId: string, filters: DocumentFilters = {}) {
  return prisma.controlledDocument.findMany({
    where: {
      companyId,
      deletedAt: null,
      status: filters.status,
      category: filters.category,
      ...(filters.search
        ? {
            OR: [
              { docNumber: { contains: filters.search } },
              { title: { contains: filters.search } },
            ],
          }
        : {}),
    },
    include: { vessel: { select: { name: true } } },
    orderBy: [{ issueDate: "desc" }],
  });
}

export async function getDocument(companyId: string, id: string) {
  return prisma.controlledDocument.findFirst({
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
