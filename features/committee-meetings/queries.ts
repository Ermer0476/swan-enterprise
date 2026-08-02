import "server-only";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";

export type MeetingFilters = { search?: string; vesselId?: string };

/**
 * Shipboard accounts (one account per vessel) see every meeting for their own
 * ship, draft or reported. Everyone else (office) only ever sees meetings
 * that have been Reported (or Closed) — a Draft hasn't "arrived" at the
 * office yet (mirrors Near Miss's DRAFT gate). AND'd separately so an office
 * filter can never be used to bypass the draft gate.
 */
export async function listCommitteeMeetings(user: SessionUser, filters: MeetingFilters = {}) {
  const isShipboard = user.department === "SHIPBOARD";
  return prisma.committeeMeeting.findMany({
    where: {
      companyId: user.companyId,
      deletedAt: null,
      AND: [
        isShipboard
          ? { vesselId: user.vesselId ?? "__no-vessel-assigned__" }
          : { vesselId: filters.vesselId || undefined },
        isShipboard ? {} : { status: { not: "DRAFT" } },
      ],
      ...(filters.search
        ? {
            OR: [
              { refNo: { contains: filters.search } },
              { chairman: { contains: filters.search } },
            ],
          }
        : {}),
    },
    include: {
      vessel: { select: { name: true } },
      agendaItems: { select: { committeeType: true }, distinct: ["committeeType"] },
    },
    orderBy: [{ meetingDate: "desc" }],
  });
}

export async function getCommitteeMeeting(user: SessionUser, id: string) {
  const isShipboard = user.department === "SHIPBOARD";
  return prisma.committeeMeeting.findFirst({
    where: {
      id,
      companyId: user.companyId,
      deletedAt: null,
      ...(isShipboard
        ? { vesselId: user.vesselId ?? "__no-vessel-assigned__" }
        : { status: { not: "DRAFT" } }),
    },
    include: {
      vessel: { select: { name: true } },
      agendaItems: { orderBy: { seq: "asc" } },
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
