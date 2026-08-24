import "server-only";
import { prisma } from "@/lib/prisma";
import { paginationArgs, paginate } from "@/lib/pagination";
import type { SessionUser } from "@/lib/auth";

export type MeetingFilters = { search?: string; vesselId?: string };

/**
 * Shipboard accounts (one account per vessel) see every meeting for their own
 * ship, draft or reported. Office sees every Reported/Closed meeting
 * fleet-wide, plus any Draft *they themselves* raised (an office-originated
 * draft hasn't "arrived" for review yet — mirrors Near Miss's DRAFT gate).
 * AND'd separately so an office filter can never be used to bypass the
 * draft gate for someone else's draft.
 */
function officeVisibilityClause(userId: string) {
  return {
    OR: [
      { status: "REPORTED" as const },
      { status: "CLOSED" as const },
      { status: "DRAFT" as const, createdBy: userId },
    ],
  };
}

export async function listCommitteeMeetings(user: SessionUser, filters: MeetingFilters = {}, page = 1) {
  const isShipboard = user.department === "SHIPBOARD";
  const where = {
    companyId: user.companyId,
    deletedAt: null,
    AND: [
      isShipboard
        ? { vesselId: user.vesselId ?? "__no-vessel-assigned__" }
        : { vesselId: filters.vesselId || undefined },
      isShipboard ? {} : officeVisibilityClause(user.id),
    ],
    ...(filters.search
      ? {
          OR: [
            { refNo: { contains: filters.search } },
            { chairman: { contains: filters.search } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.committeeMeeting.findMany({
      where,
      include: {
        vessel: { select: { name: true } },
        agendaItems: { select: { committeeType: true }, distinct: ["committeeType"] },
      },
      orderBy: [{ meetingDate: "desc" }],
      ...paginationArgs(page),
    }),
    prisma.committeeMeeting.count({ where }),
  ]);
  return paginate(rows, total, page);
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
        : { AND: [officeVisibilityClause(user.id)] }),
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

export type MeetingMonthlyComplianceRow = {
  vesselId: string;
  vesselName: string;
  heldThisMonth: boolean;
  lastMeetingDate: Date | null;
};

/** ADM-04/RC-013 requires at least one committee meeting per vessel per
 * calendar month — "held" means actually reported to office (REPORTED or
 * CLOSED), a still-open Draft doesn't count since the meeting hasn't
 * actually been minuted/submitted yet. */
export async function listCommitteeMeetingMonthlyCompliance(companyId: string): Promise<MeetingMonthlyComplianceRow[]> {
  const vessels = await prisma.vessel.findMany({
    where: { companyId, deletedAt: null, status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const vesselIds = vessels.map((v) => v.id);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const meetings = vesselIds.length
    ? await prisma.committeeMeeting.findMany({
        where: { companyId, deletedAt: null, vesselId: { in: vesselIds }, status: { in: ["REPORTED", "CLOSED"] } },
        select: { vesselId: true, meetingDate: true },
        orderBy: { meetingDate: "desc" },
      })
    : [];

  const lastByVessel = new Map<string, Date>();
  const heldThisMonth = new Set<string>();
  for (const m of meetings) {
    if (!m.vesselId) continue;
    if (!lastByVessel.has(m.vesselId)) lastByVessel.set(m.vesselId, m.meetingDate);
    if (m.meetingDate >= monthStart && m.meetingDate <= monthEnd) heldThisMonth.add(m.vesselId);
  }

  return vessels.map((v) => ({
    vesselId: v.id,
    vesselName: v.name,
    heldThisMonth: heldThisMonth.has(v.id),
    lastMeetingDate: lastByVessel.get(v.id) ?? null,
  }));
}

/** Vessels still missing this month's required committee meeting — the
 * Dashboard alert-worthy subset. */
export function committeeMeetingMonthlyAlerts(rows: MeetingMonthlyComplianceRow[]): MeetingMonthlyComplianceRow[] {
  return rows.filter((r) => !r.heldThisMonth);
}
