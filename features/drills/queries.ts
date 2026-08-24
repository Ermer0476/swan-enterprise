import "server-only";
import { prisma } from "@/lib/prisma";
import { paginationArgs, paginate } from "@/lib/pagination";
import type { DrillStatus } from "@/lib/generated/prisma";

export type DrillFilters = { search?: string; status?: DrillStatus; scheduleItemId?: string; vesselId?: string };

/**
 * Vessel accounts are shared logins (multiple crew use the same shipboard
 * account), so a shipboard user sees every draft fleet-wide. An office user
 * only sees drafts they themselves created — everyone else's drafts are
 * invisible to them until reported. AND-ed into the caller's where clause,
 * never a bare top-level OR, so a status filter can't be used to bypass it.
 */
function draftVisibilityClause(isShipboard: boolean, userId?: string) {
  if (isShipboard) return {};
  return {
    OR: [
      { status: { not: "DRAFT" as const } },
      ...(userId ? [{ status: "DRAFT" as const, createdBy: userId }] : []),
    ],
  };
}

export async function listDrills(
  companyId: string,
  filters: DrillFilters = {},
  isShipboard = false,
  userId?: string,
  page = 1,
) {
  const where = {
    companyId,
    deletedAt: null,
    status: filters.status,
    scheduleItemId: filters.scheduleItemId,
    vesselId: filters.vesselId,
    AND: [draftVisibilityClause(isShipboard, userId)],
    ...(filters.search
      ? {
          OR: [
            { refNo: { contains: filters.search } },
            { conductedBy: { contains: filters.search } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.emergencyDrill.findMany({
      where,
      include: { vessel: { select: { name: true } }, scheduleItem: { select: { name: true, itemNo: true } } },
      orderBy: [{ drillDate: "desc" }],
      ...paginationArgs(page),
    }),
    prisma.emergencyDrill.count({ where }),
  ]);
  return paginate(rows, total, page);
}

export async function getDrill(
  companyId: string,
  id: string,
  isShipboard = false,
  userId?: string,
  ownVesselId?: string | null,
) {
  return prisma.emergencyDrill.findFirst({
    where: {
      id,
      companyId,
      deletedAt: null,
      AND: [
        draftVisibilityClause(isShipboard, userId),
        isShipboard ? { vesselId: ownVesselId ?? "__no-vessel-assigned__" } : {},
      ],
    },
    include: { vessel: { select: { name: true } }, scheduleItem: true },
  });
}

export async function listVesselOptions(companyId: string) {
  return prisma.vessel.findMany({
    where: { companyId, deletedAt: null, status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
