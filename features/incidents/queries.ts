import "server-only";
import { prisma } from "@/lib/prisma";
import type { IncidentStatus, Severity } from "@/lib/generated/prisma";

export type IncidentListFilters = {
  search?: string;
  status?: IncidentStatus;
  severity?: Severity;
};

/** List incidents for a company, newest first, with optional filters. */
export async function listIncidents(
  companyId: string,
  filters: IncidentListFilters = {},
) {
  return prisma.incident.findMany({
    where: {
      companyId,
      deletedAt: null,
      status: filters.status,
      severity: filters.severity,
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
      reportedBy: { select: { fullName: true } },
      typeEntries: { orderBy: { order: "asc" } },
    },
    orderBy: [{ occurredAt: "desc" }],
  });
}

export async function getIncident(companyId: string, id: string) {
  return prisma.incident.findFirst({
    where: { id, companyId, deletedAt: null },
    include: {
      vessel: {
        select: {
          name: true,
          imo: true,
          officialNumber: true,
          callSign: true,
          mmsi: true,
          flag: true,
          type: true,
          classificationSociety: true,
          yearBuilt: true,
          grossTonnage: true,
          loa: true,
          breadth: true,
          depth: true,
        },
      },
      reportedBy: { select: { fullName: true } },
      typeEntries: { orderBy: { order: "asc" } },
      sofEntries: { orderBy: { order: "asc" } },
    },
  });
}

/** Active (non-deleted) vessels for the incident report form. */
export async function listVesselOptions(companyId: string) {
  return prisma.vessel.findMany({
    where: { companyId, deletedAt: null, status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
