import "server-only";
import { prisma } from "@/lib/prisma";
import type { DocumentStatus } from "@/lib/generated/prisma";

export type DocumentListFilters = {
  search?: string;
  status?: DocumentStatus;
  department?: string;
};

/** List SMS documents for a company, newest first, with optional filters. */
export async function listDocuments(
  companyId: string,
  filters: DocumentListFilters = {},
) {
  return prisma.smsDocument.findMany({
    where: {
      companyId,
      deletedAt: null,
      status: filters.status,
      department: filters.department
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (filters.department as any)
        : undefined,
      ...(filters.search
        ? {
            OR: [
              { code: { contains: filters.search, mode: "insensitive" } },
              { title: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      owner: { select: { fullName: true } },
      currentRevision: { select: { revisionNo: true, effectiveDate: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
  });
}

/** Full document with revision history, scoped to the company. */
export async function getDocument(companyId: string, id: string) {
  return prisma.smsDocument.findFirst({
    where: { id, companyId, deletedAt: null },
    include: {
      owner: { select: { fullName: true } },
      vessel: { select: { name: true } },
      currentRevision: true,
      revisions: { orderBy: { revisionNo: "desc" } },
    },
  });
}
