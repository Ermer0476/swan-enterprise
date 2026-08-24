import "server-only";
import { prisma } from "@/lib/prisma";
import type { ControlledDocStatus, DocumentCategory } from "@/lib/generated/prisma";

export type DocumentFilters = {
  search?: string;
  status?: ControlledDocStatus;
  category?: DocumentCategory;
  /** Present (even if null) for SHIPBOARD callers — restricts to fleet-wide
   * documents (vesselId null, labeled "Fleet-wide" in the UI) plus this
   * vessel's own. Omit entirely for OFFICE callers, who see every document. */
  shipboardVesselId?: string | null;
};

export async function listDocuments(companyId: string, filters: DocumentFilters = {}) {
  return prisma.controlledDocument.findMany({
    where: {
      companyId,
      deletedAt: null,
      status: filters.status,
      category: filters.category,
      AND: [
        filters.search
          ? {
              OR: [
                { docNumber: { contains: filters.search } },
                { title: { contains: filters.search } },
              ],
            }
          : {},
        filters.shipboardVesselId !== undefined
          ? { OR: [{ vesselId: null }, { vesselId: filters.shipboardVesselId ?? "__no-vessel-assigned__" }] }
          : {},
      ],
    },
    include: { vessel: { select: { name: true } } },
    orderBy: [{ issueDate: "desc" }],
  });
}

/** `shipboardVesselId` — pass the caller's vessel id (or null) when the
 * caller is SHIPBOARD to restrict to a fleet-wide document (vesselId null)
 * or this vessel's own; omit entirely for OFFICE callers. */
export async function getDocument(companyId: string, id: string, shipboardVesselId?: string | null) {
  return prisma.controlledDocument.findFirst({
    where: {
      id,
      companyId,
      deletedAt: null,
      ...(shipboardVesselId !== undefined
        ? { OR: [{ vesselId: null }, { vesselId: shipboardVesselId ?? "__no-vessel-assigned__" }] }
        : {}),
    },
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
