import "server-only";
import { prisma } from "@/lib/prisma";
import { startOfToday } from "@/lib/kpi-period";
import { paginationArgs, paginate } from "@/lib/pagination";
import { INTERNAL_AUDIT_SCHEDULE_MONTHS, type InternalAuditScheduleUrgency } from "./schema";
import type { InternalAuditStatus } from "@/lib/generated/prisma";

export type InternalAuditFilters = { search?: string; status?: InternalAuditStatus; vesselId?: string };

/**
 * No shipboard role holds iaudit:create (audits are office-only — QHSE
 * Manager / Marine Superintendent), so unlike the ship-vs-office split used
 * elsewhere, every viewer here is scoped the same way: everyone sees their
 * own drafts, nobody sees anyone else's until it's reported. AND-ed into the
 * caller's where clause, never a bare top-level OR, so a status filter can't
 * be used to bypass it.
 */
function draftVisibilityClause(userId?: string) {
  return {
    OR: [
      { status: { not: "DRAFT" as const } },
      ...(userId ? [{ status: "DRAFT" as const, createdBy: userId }] : []),
    ],
  };
}

export async function listInternalAudits(
  companyId: string,
  filters: InternalAuditFilters = {},
  userId?: string,
  page = 1,
) {
  const where = {
    companyId,
    deletedAt: null,
    status: filters.status,
    vesselId: filters.vesselId,
    AND: [draftVisibilityClause(userId)],
    ...(filters.search
      ? {
          OR: [
            { refNo: { contains: filters.search } },
            { scope: { contains: filters.search } },
          ],
        }
      : {}),
  };

  const [audits, total] = await Promise.all([
    prisma.internalAudit.findMany({
      where,
      include: {
        vessel: { select: { name: true } },
        findings: { where: { deletedAt: null }, select: { id: true } },
      },
      orderBy: [{ auditDate: "desc" }],
      ...paginationArgs(page),
    }),
    prisma.internalAudit.count({ where }),
  ]);

  // CAPA rows live under the finding directly, unless the finding was raised
  // into an NCR — in that case the actions moved to the NCR record instead
  // (see createNcrAction). This list-level rollup only counts what's still on
  // the finding itself; NCR-linked corrective actions surface on the NCR's
  // own tracker instead of double-counting here.
  const findingIds = audits.flatMap((a) => a.findings.map((f) => f.id));
  const capaRows = findingIds.length
    ? await prisma.capaAction.findMany({
        where: {
          companyId,
          deletedAt: null,
          entityType: "InternalAuditFinding",
          entityId: { in: findingIds },
          status: { not: "CLOSED" },
        },
        select: { entityId: true, targetDate: true },
      })
    : [];

  const findingToAudit = new Map<string, string>();
  for (const a of audits) for (const f of a.findings) findingToAudit.set(f.id, a.id);

  const today = startOfToday();
  const capaPendingByAudit = new Map<string, number>();
  const capaOverdueByAudit = new Map<string, number>();
  for (const row of capaRows) {
    const auditId = findingToAudit.get(row.entityId);
    if (!auditId) continue;
    capaPendingByAudit.set(auditId, (capaPendingByAudit.get(auditId) ?? 0) + 1);
    if (row.targetDate && row.targetDate < today) {
      capaOverdueByAudit.set(auditId, (capaOverdueByAudit.get(auditId) ?? 0) + 1);
    }
  }

  const rows = audits.map((a) => ({
    ...a,
    findingCount: a.findings.length,
    capaPending: capaPendingByAudit.get(a.id) ?? 0,
    capaOverdue: capaOverdueByAudit.get(a.id) ?? 0,
  }));
  return paginate(rows, total, page);
}

export async function getInternalAudit(companyId: string, id: string, userId?: string, vesselId?: string) {
  const audit = await prisma.internalAudit.findFirst({
    where: { id, companyId, deletedAt: null, vesselId, AND: [draftVisibilityClause(userId)] },
    include: {
      vessel: { select: { name: true } },
      findings: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!audit) return null;

  const findingIds = audit.findings.map((f) => f.id);
  const attachments = findingIds.length
    ? await prisma.attachment.findMany({
        where: { companyId, entityType: "InternalAuditFinding", entityId: { in: findingIds }, deletedAt: null },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return {
    ...audit,
    findings: audit.findings.map((f) => ({
      ...f,
      attachments: attachments.filter((a) => a.entityId === f.id),
    })),
  };
}

export async function listVesselOptions(companyId: string) {
  return prisma.vessel.findMany({
    where: { companyId, deletedAt: null, status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

// Same UTC month-arithmetic helpers as features/sire/queries.ts's schedule
// math — duplicated rather than shared, since the two modules' schema
// constants (and any future divergence in rounding rules) should stay free
// to move independently.
function lastDayOfMonthUTC(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

function addMonthsUTC(d: Date, months: number): Date {
  const total = d.getUTCFullYear() * 12 + d.getUTCMonth() + months;
  const year = Math.floor(total / 12);
  const month0 = ((total % 12) + 12) % 12;
  const day = Math.min(d.getUTCDate(), lastDayOfMonthUTC(year, month0));
  return new Date(Date.UTC(year, month0, day));
}

export type InternalAuditScheduleRow = {
  vesselId: string;
  vesselName: string;
  lastAuditDate: Date | null;
  lastAuditRefNo: string | null;
  scheduledDue: Date | null; // last (reported) audit + INTERNAL_AUDIT_SCHEDULE_MONTHS
  urgency: InternalAuditScheduleUrgency;
  dueThisMonth: boolean;
};

/** Rows worth surfacing on the Dashboard's alert widget — due this month, or
 * never audited at all (same "alert-worthy" convention as
 * sireScheduleAlerts). */
export function internalAuditScheduleAlerts(rows: InternalAuditScheduleRow[]): InternalAuditScheduleRow[] {
  return rows.filter((r) => r.dueThisMonth || r.urgency === "NOT_YET_AUDITED");
}

/**
 * Fleet-wide "next internal audit due" matrix — ISM requires one per vessel
 * at least every 12 months. Next due is derived purely from the latest
 * REPORTED (non-draft) InternalAudit.auditDate per vessel + 12 months;
 * nothing about a schedule is persisted anywhere. Same shape/urgency
 * thresholds as features/sire/queries.ts's listSireSchedule, just without a
 * separate "validity expires" date (an internal audit doesn't lapse the way
 * a SIRE report's OCIMF validity does — it's purely a recurrence interval).
 */
export async function listInternalAuditSchedule(companyId: string, vesselId?: string): Promise<InternalAuditScheduleRow[]> {
  const vessels = await prisma.vessel.findMany({
    where: { companyId, deletedAt: null, status: "ACTIVE", ...(vesselId ? { id: vesselId } : {}) },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const vesselIds = vessels.map((v) => v.id);

  const audits = vesselIds.length
    ? await prisma.internalAudit.findMany({
        where: { companyId, deletedAt: null, status: { not: "DRAFT" }, vesselId: { in: vesselIds } },
        select: { vesselId: true, auditDate: true, refNo: true },
        orderBy: { auditDate: "desc" },
      })
    : [];
  const latestByVessel = new Map<string, { date: Date; refNo: string | null }>();
  for (const audit of audits) {
    if (!audit.vesselId || latestByVessel.has(audit.vesselId)) continue;
    latestByVessel.set(audit.vesselId, { date: audit.auditDate, refNo: audit.refNo });
  }

  const today = startOfToday();
  const DUE_SOON_DAYS = 30;

  const rows: InternalAuditScheduleRow[] = vessels.map((v) => {
    const last = latestByVessel.get(v.id);
    if (!last) {
      return {
        vesselId: v.id,
        vesselName: v.name,
        lastAuditDate: null,
        lastAuditRefNo: null,
        scheduledDue: null,
        urgency: "NOT_YET_AUDITED",
        dueThisMonth: false,
      };
    }
    const scheduledDue = addMonthsUTC(last.date, INTERNAL_AUDIT_SCHEDULE_MONTHS);
    const daysUntilDue = Math.round((scheduledDue.getTime() - today.getTime()) / 86_400_000);
    const urgency: InternalAuditScheduleUrgency =
      daysUntilDue < 0 ? "OVERDUE" : daysUntilDue <= DUE_SOON_DAYS ? "DUE_SOON" : "ON_TRACK";
    const dueThisMonth =
      scheduledDue <= today ||
      (scheduledDue.getUTCFullYear() === today.getUTCFullYear() && scheduledDue.getUTCMonth() === today.getUTCMonth());
    return {
      vesselId: v.id,
      vesselName: v.name,
      lastAuditDate: last.date,
      lastAuditRefNo: last.refNo,
      scheduledDue,
      urgency,
      dueThisMonth,
    };
  });

  return rows.sort((a, b) => {
    const rank = (r: InternalAuditScheduleRow) => (r.scheduledDue ? r.scheduledDue.getTime() : -Infinity);
    return rank(a) - rank(b);
  });
}
