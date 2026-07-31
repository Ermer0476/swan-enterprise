import "server-only";
import { prisma } from "@/lib/prisma";
import type { FindingStatus, MeetingType } from "@/lib/generated/prisma";

export type MeetingFilters = { search?: string; status?: FindingStatus; meetingType?: MeetingType };

export async function listMeetings(companyId: string, filters: MeetingFilters = {}) {
  return prisma.safetyMeeting.findMany({
    where: {
      companyId,
      deletedAt: null,
      status: filters.status,
      meetingType: filters.meetingType,
      ...(filters.search
        ? {
            OR: [
              { refNo: { contains: filters.search, mode: "insensitive" } },
              { chairedBy: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { vessel: { select: { name: true } } },
    orderBy: [{ meetingDate: "desc" }],
  });
}

export async function getMeeting(companyId: string, id: string) {
  return prisma.safetyMeeting.findFirst({
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
