import "server-only";
import { prisma } from "@/lib/prisma";
import { getKpiPeriod, quarterEndDate, startOfToday } from "@/lib/kpi-period";
import { paginationArgs, paginate } from "@/lib/pagination";
import { DEFAULT_SIRE_OBSERVATION_TARGET, SIRE_SCHEDULE_MONTHS, SIRE_VALIDITY_MONTHS, type SireScheduleUrgency } from "./schema";
import type { InspectionStatus } from "@/lib/generated/prisma";

export type SireFilters = { search?: string; status?: InspectionStatus };

/**
 * Each row carries `obsClosed`/`obsTotal` — SIRE has no separate CAPA
 * tracker; an observation tracks its own corrective-action lifecycle
 * directly (SireObservation.status: OPEN → ONGOING → PENDING_VERIFICATION →
 * CLOSED). "Closed" here means observations whose own status is CLOSED.
 */
export async function listSire(
  companyId: string,
  filters: SireFilters = {},
  isShipboard = false,
  vesselId?: string | null,
  page = 1,
) {
  const where = {
    companyId,
    deletedAt: null,
    status: filters.status,
    // Shipboard accounts must only ever see their own vessel's SIRE
    // inspections — forced here (never from a client-supplied filter). The
    // sentinel guarantees zero rows rather than an accidental fleet-wide
    // match if a shipboard user somehow has no vesselId assigned.
    ...(isShipboard ? { vesselId: vesselId ?? "__no-vessel-assigned__" } : {}),
    ...(filters.search
      ? {
          OR: [
            { refNo: { contains: filters.search } },
            { inspectingCompany: { contains: filters.search } },
          ],
        }
      : {}),
  };

  const [inspections, total] = await Promise.all([
    prisma.sireInspection.findMany({
      where,
      include: {
        vessel: { select: { name: true } },
        observations: { where: { deletedAt: null }, select: { status: true, targetDate: true } },
      },
      orderBy: [{ inspectionDate: "desc" }],
      ...paginationArgs(page),
    }),
    prisma.sireInspection.count({ where }),
  ]);

  const today = startOfToday();
  const rows = inspections.map((insp) => {
    const obsTotal = insp.observations.length;
    const obsClosed = insp.observations.filter((o) => o.status === "CLOSED").length;
    const pending = insp.observations.filter((o) => o.status !== "CLOSED");
    const capaPending = pending.length;
    const capaOverdue = pending.filter((o) => o.targetDate && o.targetDate < today).length;
    return { ...insp, obsTotal, obsClosed, capaPending, capaOverdue };
  });
  return paginate(rows, total, page);
}

export async function getSire(companyId: string, id: string, isShipboard = false, vesselId?: string | null) {
  const insp = await prisma.sireInspection.findFirst({
    where: {
      id,
      companyId,
      deletedAt: null,
      ...(isShipboard ? { vesselId: vesselId ?? "__no-vessel-assigned__" } : {}),
    },
    include: {
      vessel: { select: { name: true } },
      observations: {
        where: { deletedAt: null },
        include: {
          responsiblePerson: { select: { fullName: true } },
          verifiedBy: { select: { fullName: true } },
          comments: {
            orderBy: { createdAt: "asc" },
            include: { author: { select: { fullName: true } } },
          },
        },
        orderBy: { seq: "asc" },
      },
    },
  });
  if (!insp) return null;

  const observationIds = insp.observations.map((o) => o.id);
  const attachments = observationIds.length
    ? await prisma.attachment.findMany({
        where: { companyId, entityType: "SireObservation", entityId: { in: observationIds }, deletedAt: null },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return {
    ...insp,
    observations: insp.observations.map((o) => ({
      ...o,
      attachments: attachments.filter((a) => a.entityId === o.id),
    })),
  };
}

function lastDayOfMonthUTC(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

/** Adds `months` to a UTC-midnight date, clamping the day-of-month to the
 * target month's length (e.g. Jan 31 + 1 month → Feb 28/29, not Mar 3). */
function addMonthsUTC(d: Date, months: number): Date {
  const total = d.getUTCFullYear() * 12 + d.getUTCMonth() + months;
  const year = Math.floor(total / 12);
  const month0 = ((total % 12) + 12) % 12;
  const day = Math.min(d.getUTCDate(), lastDayOfMonthUTC(year, month0));
  return new Date(Date.UTC(year, month0, day));
}

export type SireScheduleRow = {
  vesselId: string;
  vesselName: string;
  lastInspectionDate: Date | null;
  lastInspectionRefNo: string | null;
  scheduledDue: Date | null; // last inspection + SIRE_SCHEDULE_MONTHS
  validityExpires: Date | null; // last inspection + SIRE_VALIDITY_MONTHS
  urgency: SireScheduleUrgency;
  /** scheduledDue falls within the current calendar month (or has already
   * passed) — the "due this month" signal the dashboard alert and the SIRE
   * Schedule button's badge both key off. */
  dueThisMonth: boolean;
};

/** Vessels that should surface in a "needs attention" notification — due
 * this month, already overdue, or never inspected at all. Shared by the
 * dashboard alert card and the SIRE Schedule button's badge count so the
 * two numbers never drift apart. */
export function sireScheduleAlerts(rows: SireScheduleRow[]): SireScheduleRow[] {
  return rows.filter((r) => r.dueThisMonth || r.urgency === "NOT_YET_INSPECTED");
}

/**
 * SIRE reports are valid 6 months, but the office re-inspects at the
 * 5-month mark so a delayed follow-up never lets validity actually lapse.
 * This builds that schedule fleet-wide: for every active vessel, its last
 * SIRE inspection date, when the next one is scheduled (+5mo), when the
 * current report's validity hard-expires (+6mo), and an urgency bucket —
 * sorted so the vessel needing attention soonest is always on top.
 */
export async function listSireSchedule(companyId: string): Promise<SireScheduleRow[]> {
  const vessels = await prisma.vessel.findMany({
    where: { companyId, deletedAt: null, status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const vesselIds = vessels.map((v) => v.id);

  const inspections = vesselIds.length
    ? await prisma.sireInspection.findMany({
        where: { companyId, deletedAt: null, vesselId: { in: vesselIds } },
        select: { vesselId: true, inspectionDate: true, refNo: true },
        orderBy: { inspectionDate: "desc" },
      })
    : [];
  const latestByVessel = new Map<string, { date: Date; refNo: string }>();
  for (const insp of inspections) {
    if (!insp.vesselId || latestByVessel.has(insp.vesselId)) continue;
    latestByVessel.set(insp.vesselId, { date: insp.inspectionDate, refNo: insp.refNo });
  }

  const today = startOfToday();
  const DUE_SOON_DAYS = 30;

  const rows: SireScheduleRow[] = vessels.map((v) => {
    const last = latestByVessel.get(v.id);
    if (!last) {
      return {
        vesselId: v.id,
        vesselName: v.name,
        lastInspectionDate: null,
        lastInspectionRefNo: null,
        scheduledDue: null,
        validityExpires: null,
        urgency: "NOT_YET_INSPECTED",
        dueThisMonth: false,
      };
    }
    const scheduledDue = addMonthsUTC(last.date, SIRE_SCHEDULE_MONTHS);
    const validityExpires = addMonthsUTC(last.date, SIRE_VALIDITY_MONTHS);
    const daysUntilDue = Math.round((scheduledDue.getTime() - today.getTime()) / 86_400_000);
    const urgency: SireScheduleUrgency =
      daysUntilDue < 0 ? "OVERDUE" : daysUntilDue <= DUE_SOON_DAYS ? "DUE_SOON" : "ON_TRACK";
    const dueThisMonth =
      scheduledDue <= today ||
      (scheduledDue.getUTCFullYear() === today.getUTCFullYear() && scheduledDue.getUTCMonth() === today.getUTCMonth());
    return {
      vesselId: v.id,
      vesselName: v.name,
      lastInspectionDate: last.date,
      lastInspectionRefNo: last.refNo,
      scheduledDue,
      validityExpires,
      urgency,
      dueThisMonth,
    };
  });

  // Most urgent first: never-inspected vessels lead, then by scheduled due
  // date ascending — a vessel due next week always outranks one due next
  // quarter, regardless of whether either is already technically overdue.
  return rows.sort((a, b) => {
    const rank = (r: SireScheduleRow) => (r.scheduledDue ? r.scheduledDue.getTime() : -Infinity);
    return rank(a) - rank(b);
  });
}

/** Resolve an (optional) year + quarter to an INCLUSIVE date range for
 * filtering SireInspection.inspectionDate. No year = all time (quarter is
 * ignored in that case, since "just this quarter, no particular year" isn't
 * a meaningful filter). Year with no quarter = the whole year. Year+quarter
 * uses the shared KPI Period Service with measurementPeriod "YTD" — TMSA/
 * OCIMF cumulative reporting, so Q2 means Jan–Jun, not just Apr–Jun (see
 * lib/kpi-period.ts). */
export function resolveSirePeriod(year?: number, quarter?: number): { from?: Date; to?: Date } {
  if (!year) return {};
  if (!quarter || quarter < 1 || quarter > 4) {
    return { from: new Date(Date.UTC(year, 0, 1)), to: new Date(Date.UTC(year, 11, 31)) };
  }
  const period = getKpiPeriod({
    measurementPeriod: "YTD",
    reportingDate: quarterEndDate(year, quarter as 1 | 2 | 3 | 4),
  });
  return { from: period.periodStart, to: period.periodEnd };
}

/** Fleet-wide SIRE KPIs for a date range: average observations per
 * inspection, breakdowns by observation category, root cause (+ sub-cause),
 * and per-vessel totals split by inspecting company ("Oil Major"). Computed
 * in one pass since inspection/observation volumes are small per company. */
export async function sireAnalytics(companyId: string, range: { from?: Date; to?: Date }) {
  const inspections = await prisma.sireInspection.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(range.from || range.to
        ? { inspectionDate: { gte: range.from, lte: range.to } }
        : {}),
    },
    select: {
      id: true,
      inspectingCompany: true,
      vessel: { select: { id: true, name: true } },
      observations: {
        where: { deletedAt: null },
        select: { category: true, rootCauseCategory: true, rootCauseSubCategory: true, chapter: true },
      },
    },
  });

  const totalInspections = inspections.length;
  const totalObservations = inspections.reduce((sum, i) => sum + i.observations.length, 0);

  const byCategory: Record<string, number> = {};
  const byRootCause: Record<string, number> = {};
  const bySubRootCause: Record<string, { category: string; subCategory: string; count: number }> = {};
  const byVesselOilMajor: Record<string, Record<string, number>> = {};
  // Keyed by VIQ chapter number (1-12) — zero-filled by the caller from
  // VIQ_CHAPTERS so the chart always shows all 12 chapters, not just the
  // ones with observations.
  const byChapter: Record<number, number> = {};

  for (const insp of inspections) {
    const vesselName = insp.vessel?.name ?? "Fleet-wide";
    const oilMajor = insp.inspectingCompany || "Unspecified";
    byVesselOilMajor[vesselName] ??= {};
    byVesselOilMajor[vesselName][oilMajor] =
      (byVesselOilMajor[vesselName][oilMajor] ?? 0) + insp.observations.length;

    for (const obs of insp.observations) {
      const cat = obs.category ?? "UNSPECIFIED";
      byCategory[cat] = (byCategory[cat] ?? 0) + 1;

      if (obs.chapter) {
        byChapter[obs.chapter] = (byChapter[obs.chapter] ?? 0) + 1;
      }

      if (obs.rootCauseCategory) {
        byRootCause[obs.rootCauseCategory] = (byRootCause[obs.rootCauseCategory] ?? 0) + 1;
        // Bucketed under "" (Unspecified) when the sub-category hasn't been
        // filled in yet, so this always sums to byRootCause[category] — the
        // sub-cause donut's total previously fell short of the bar chart's
        // count whenever a root cause was tagged without its sub-category.
        const subCategory = obs.rootCauseSubCategory ?? "";
        const key = `${obs.rootCauseCategory}::${subCategory}`;
        bySubRootCause[key] ??= {
          category: obs.rootCauseCategory,
          subCategory,
          count: 0,
        };
        bySubRootCause[key]!.count += 1;
      }
    }
  }

  return {
    totalInspections,
    totalObservations,
    avgPerInspection: totalInspections ? totalObservations / totalInspections : 0,
    byCategory,
    byRootCause,
    bySubRootCause: Object.values(bySubRootCause),
    byVesselOilMajor,
    byChapter,
  };
}

export async function getSireKpiTargets(companyId: string): Promise<{ avgObservationTarget: number }> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { sireAvgObservationTarget: true },
  });
  return { avgObservationTarget: company?.sireAvgObservationTarget ?? DEFAULT_SIRE_OBSERVATION_TARGET };
}

export async function listVesselOptions(companyId: string) {
  return prisma.vessel.findMany({
    where: { companyId, deletedAt: null, status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function listPersonnelOptions(companyId: string) {
  return prisma.user.findMany({
    where: { companyId, deletedAt: null, active: true },
    select: { id: true, fullName: true, rank: true },
    orderBy: { fullName: "asc" },
  });
}
