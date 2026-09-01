import "server-only";
import { prisma } from "@/lib/prisma";
import { paginationArgs, paginate } from "@/lib/pagination";
import type { DefectStatus, DefectSeverity } from "@/lib/generated/prisma";

export type DefectFilters = { search?: string; status?: DefectStatus; severity?: DefectSeverity; vesselId?: string };

export async function listDefects(companyId: string, filters: DefectFilters = {}, page = 1) {
  const where = {
    companyId,
    deletedAt: null,
    status: filters.status,
    severity: filters.severity,
    vesselId: filters.vesselId,
    ...(filters.search
      ? {
          OR: [
            { refNo: { contains: filters.search } },
            { equipment: { contains: filters.search } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.defect.findMany({
      where,
      include: { vessel: { select: { name: true } } },
      orderBy: [{ dateRaised: "desc" }],
      ...paginationArgs(page),
    }),
    prisma.defect.count({ where }),
  ]);
  return paginate(rows, total, page);
}

export async function getDefect(companyId: string, id: string, isShipboard = false, vesselId?: string | null) {
  return prisma.defect.findFirst({
    where: {
      id,
      companyId,
      deletedAt: null,
      ...(isShipboard ? { vesselId: vesselId ?? "__no-vessel-assigned__" } : {}),
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
