import "server-only";
import { prisma } from "@/lib/prisma";
import type { NearMissStatus, Severity } from "@/lib/generated/prisma";

export type NearMissFilters = {
  search?: string;
  status?: NearMissStatus;
  potentialSeverity?: Severity;
};

/**
 * Drafts are a vessel's own work-in-progress — invisible to the office until
 * the vessel clicks "Report Near Miss" (status moves DRAFT → REPORTED).
 * `isShipboard` controls whether DRAFT rows are included at all.
 */
export async function listNearMisses(
  companyId: string,
  filters: NearMissFilters = {},
  isShipboard = false,
) {
  return prisma.nearMiss.findMany({
    where: {
      companyId,
      deletedAt: null,
      potentialSeverity: filters.potentialSeverity,
      // AND'd separately (rather than a single `status` key) so an office
      // user can never bypass the draft gate by explicitly filtering
      // status=DRAFT — both conditions must hold at once.
      AND: [
        filters.status ? { status: filters.status } : {},
        isShipboard ? {} : { status: { not: "DRAFT" } },
      ],
      ...(filters.search
        ? {
            OR: [
              { refNo: { contains: filters.search } },
              { title: { contains: filters.search } },
            ],
          }
        : {}),
    },
    include: {
      vessel: { select: { name: true } },
      reportedBy: { select: { fullName: true } },
    },
    orderBy: [{ occurredAt: "desc" }],
  });
}

export async function getNearMiss(companyId: string, id: string, isShipboard = false) {
  return prisma.nearMiss.findFirst({
    where: {
      id,
      companyId,
      deletedAt: null,
      ...(isShipboard ? {} : { status: { not: "DRAFT" } }),
    },
    include: {
      vessel: { select: { name: true } },
      reportedBy: { select: { fullName: true } },
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
