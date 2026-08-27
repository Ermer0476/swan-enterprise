import "server-only";
import { prisma } from "@/lib/prisma";
import { getKpiPeriod, startOfToday } from "@/lib/kpi-period";
import { paginationArgs, paginate } from "@/lib/pagination";
import type { IncidentStatus, Severity, IncidentType } from "@/lib/generated/prisma";
import {
  ROOT_CAUSE_LABELS,
  ROOT_CAUSE_SUBCATEGORY_LABELS,
  type RootCauseCategoryValue,
} from "@/lib/root-cause";
import {
  INCIDENT_TYPES,
  INCIDENT_TYPE_LABELS,
  INCIDENT_SUBCATEGORY_LABELS,
  type IncidentTypeValue,
} from "./schema";
import { getReferenceList } from "@/lib/reference-list";
import { incidentSubcategoryKey, type ReferenceOption } from "@/lib/reference-registry";

/** Per-incident-type sub-category options for the report/edit pickers, read
 * from the office-editable reference list (registry fallback when a company
 * has no rows). One entry per INCIDENT_TYPE, in the same order. */
export type IncidentSubcategoryOptions = Record<IncidentTypeValue, ReferenceOption[]>;

export async function getIncidentSubcategoryOptions(
  companyId: string,
): Promise<IncidentSubcategoryOptions> {
  const lists = await Promise.all(
    INCIDENT_TYPES.map((t) => getReferenceList(companyId, incidentSubcategoryKey(t))),
  );
  return Object.fromEntries(
    INCIDENT_TYPES.map((t, i) => [t, lists[i] ?? []]),
  ) as IncidentSubcategoryOptions;
}

// LTI = FAT + PTD + PPD + LWC; TRC = LTI + RWC + MTC (i.e. every Personal
// Injury sub-category except FAC) — same OCIMF-style formula as
// features/exposure-hours/schema.ts, applied here per-incident rather than
// as a monthly aggregate.
const LTI_CODES = new Set(["FAT", "PTD", "PPD", "LWC"]);
const TRC_CODES = new Set(["FAT", "PTD", "PPD", "LWC", "RWC", "MTC"]);

export type IncidentListFilters = {
  search?: string;
  status?: IncidentStatus;
  severity?: Severity;
  // Office-side "narrow to one vessel" filter — ignored for shipboard
  // callers, who are already forced to their own vessel below regardless of
  // what's passed here.
  vesselId?: string;
};

/**
 * Drafts are the reporter's own work-in-progress — invisible to everyone
 * else until "Report Incident" moves it to REPORTED. Any shipboard user
 * sees every draft fleet-wide (shared vessel logins); an office user only
 * ever sees the drafts *they themselves* raised (pass their own `userId`).
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

/** List incidents for a company, newest first, with optional filters. Each
 * row carries `capaClosed`/`capaTotal` — CAPA attaches directly to the
 * Incident (not to a sub-entity like SIRE/CDI observations), so this is a
 * straight per-incident CAPA action count. */
export async function listIncidents(
  companyId: string,
  filters: IncidentListFilters = {},
  isShipboard = false,
  userId?: string,
  vesselId?: string | null,
  page = 1,
) {
  const where = {
    companyId,
    deletedAt: null,
    severity: filters.severity,
    AND: [
      filters.status ? { status: filters.status } : {},
      draftVisibilityClause(isShipboard, userId),
      // Shipboard accounts must only ever see their own vessel's incidents —
      // forced here (never from a client-supplied filter) so an office-only
      // fleet-wide view can never leak to a shipboard login. The sentinel
      // guarantees zero rows rather than an accidental fleet-wide match if a
      // shipboard user somehow has no vesselId assigned.
      isShipboard
        ? { vesselId: vesselId ?? "__no-vessel-assigned__" }
        : filters.vesselId
          ? { vesselId: filters.vesselId }
          : {},
    ],
    ...(filters.search
      ? {
          OR: [
            { refNo: { contains: filters.search } },
            { title: { contains: filters.search } },
          ],
        }
      : {}),
  };

  const [incidents, total] = await Promise.all([
    prisma.incident.findMany({
      where,
      include: {
        vessel: { select: { name: true } },
        reportedBy: { select: { fullName: true } },
        typeEntries: { orderBy: { order: "asc" } },
      },
      orderBy: [{ occurredAt: "desc" }],
      ...paginationArgs(page),
    }),
    prisma.incident.count({ where }),
  ]);

  const incidentIds = incidents.map((i) => i.id);
  const capaRows = incidentIds.length
    ? await prisma.capaAction.findMany({
        where: { companyId, deletedAt: null, entityType: "Incident", entityId: { in: incidentIds } },
        select: { entityId: true, status: true },
      })
    : [];
  const capaByIncident = new Map<string, { total: number; closed: number }>();
  for (const c of capaRows) {
    const agg = capaByIncident.get(c.entityId) ?? { total: 0, closed: 0 };
    agg.total += 1;
    if (c.status === "CLOSED") agg.closed += 1;
    capaByIncident.set(c.entityId, agg);
  }

  const rows = incidents.map((inc) => {
    const capa = capaByIncident.get(inc.id) ?? { total: 0, closed: 0 };
    return { ...inc, capaClosed: capa.closed, capaTotal: capa.total };
  });
  return paginate(rows, total, page);
}

export async function getIncident(
  companyId: string,
  id: string,
  isShipboard = false,
  userId?: string,
  vesselId?: string | null,
) {
  return prisma.incident.findFirst({
    where: {
      id,
      companyId,
      deletedAt: null,
      AND: [draftVisibilityClause(isShipboard, userId)],
      ...(isShipboard ? { vesselId: vesselId ?? "__no-vessel-assigned__" } : {}),
    },
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

export type IncidentKpis = {
  totalYtd: number;
  lti: number;
  trc: number;
  fatalities: number;
  openCount: number;
  openBySeverity: { low: number; medium: number; high: number; critical: number; unspecified: number };
  overdueCount: number;
  capaClosureRate: number | null; // null when there are no CAPA items yet
  avgDaysToClose: number | null; // null when nothing has closed this year
};

// Investigations still open past this many days are flagged "overdue" — a
// stand-in for TMSA's expectation that investigations close out within a
// defined target time, not left open indefinitely.
const OVERDUE_DAYS = 30;

/**
 * TMSA Element 6 (Incident Investigation & Analysis) style KPIs: injury
 * counts by OCIMF classification (LTI / TRC / Fatality), investigation
 * backlog and timeliness, and corrective-action close-out — the indicators
 * that self-assessment actually looks for, computed from data already on
 * hand (no separate man-hours/exposure tracking exists, so this reports
 * counts and rates rather than frequency-per-man-hours).
 *
 * Review Frequency: Quarterly · Measurement Period: Rolling 12 Months
 * (resolved via the shared KPI Period Service — lib/kpi-period.ts), ending
 * on reportingDate (default: today, the live view). `openCount`/
 * `overdueCount`/`capaClosureRate` stay live/all-time snapshots — they're
 * operational counts ("what's open right now"), not period metrics.
 */
export async function getIncidentKpis(
  companyId: string,
  reportingDate: Date = startOfToday(),
): Promise<IncidentKpis> {
  const today = startOfToday();
  const asOf = reportingDate < today ? reportingDate : today;
  const period = getKpiPeriod({ measurementPeriod: "ROLLING_12", reportingDate: asOf });

  const [inPeriod, open, injuryEntriesInPeriod, capaRows] = await Promise.all([
    // Bounded to the rolling-12 window at the DB level — this used to fetch
    // every incident the company has ever had and filter in JS, which grows
    // unbounded with fleet history instead of with the (fixed-size) window.
    prisma.incident.findMany({
      where: { companyId, deletedAt: null, occurredAt: { gte: period.periodStart, lte: period.periodEnd } },
      select: { status: true, occurredAt: true, closedAt: true },
    }),
    // openCount/overdueCount are an all-time operational snapshot by design
    // (see doc comment above) — bounding this to status != CLOSED instead of
    // fetching the whole table keeps it naturally small (open incidents
    // don't accumulate the way total history does; they clear as they close).
    prisma.incident.findMany({
      where: { companyId, deletedAt: null, status: { not: "CLOSED" } },
      select: { occurredAt: true, severity: true },
    }),
    prisma.incidentTypeEntry.findMany({
      where: {
        type: "PERSONAL_INJURY",
        incident: {
          companyId,
          deletedAt: null,
          occurredAt: { gte: period.periodStart, lte: period.periodEnd },
        },
      },
      select: { subCategory: true },
    }),
    prisma.capaAction.findMany({
      where: { companyId, entityType: "Incident", deletedAt: null },
      select: { status: true },
    }),
  ]);

  const lti = injuryEntriesInPeriod.filter((t) => LTI_CODES.has(t.subCategory)).length;
  const trc = injuryEntriesInPeriod.filter((t) => TRC_CODES.has(t.subCategory)).length;
  const fatalities = injuryEntriesInPeriod.filter((t) => t.subCategory === "FAT").length;

  const now = Date.now();
  const overdueCount = open.filter(
    (i) => now - i.occurredAt.getTime() > OVERDUE_DAYS * 24 * 60 * 60 * 1000,
  ).length;

  const openBySeverity = {
    low: open.filter((i) => i.severity === "LOW").length,
    medium: open.filter((i) => i.severity === "MEDIUM").length,
    high: open.filter((i) => i.severity === "HIGH").length,
    critical: open.filter((i) => i.severity === "CRITICAL").length,
    unspecified: open.filter((i) => i.severity === null).length,
  };

  const capaClosureRate =
    capaRows.length > 0
      ? Math.round((capaRows.filter((c) => c.status === "CLOSED").length / capaRows.length) * 100)
      : null;

  const closedInPeriod = inPeriod.filter(
    (i): i is typeof i & { closedAt: Date } => i.status === "CLOSED" && i.closedAt !== null,
  );
  const avgDaysToClose =
    closedInPeriod.length > 0
      ? Math.round(
          closedInPeriod.reduce((sum, i) => sum + (i.closedAt.getTime() - i.occurredAt.getTime()) / 86_400_000, 0) /
            closedInPeriod.length,
        )
      : null;

  return {
    totalYtd: inPeriod.length,
    lti,
    trc,
    fatalities,
    openCount: open.length,
    openBySeverity,
    overdueCount,
    capaClosureRate,
    avgDaysToClose,
  };
}

export type TrendSubRow = {
  key: string;
  label: string;
  count: number;
};

export type RootCauseCategoryTrend = {
  key: string;
  category: string;
  label: string;
  count: number;
  subRows: TrendSubRow[];
};

// Below this many occurrences, a sub-category is just something that
// happened once — not yet a pattern worth flagging as systemic.
export const REPEAT_THRESHOLD = 2;

/**
 * Root causes grouped by top-level category, each carrying its own
 * sub-category breakdown (rootCauseCategory unset = not yet investigated,
 * excluded). TMSA looks for evidence that root-cause data actually feeds
 * back into finding systemic patterns — the category view gives the
 * overview, the sub-category drill-down is where a specific recurring cause
 * (e.g. "Equipment failure" showing up 3 times) actually surfaces.
 */
export async function getIncidentRootCauseTrends(
  companyId: string,
  range?: { from: Date; to: Date },
): Promise<RootCauseCategoryTrend[]> {
  const rows = await prisma.incident.findMany({
    where: {
      companyId,
      deletedAt: null,
      rootCauseCategory: { not: null },
      ...(range ? { occurredAt: { gte: range.from, lte: range.to } } : {}),
    },
    select: { rootCauseCategory: true, rootCauseSubCategory: true },
  });

  const byCategory = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (!r.rootCauseCategory) continue;
    const subMap = byCategory.get(r.rootCauseCategory) ?? new Map<string, number>();
    const subKey = r.rootCauseSubCategory ?? "";
    subMap.set(subKey, (subMap.get(subKey) ?? 0) + 1);
    byCategory.set(r.rootCauseCategory, subMap);
  }

  return Array.from(byCategory.entries())
    .map(([category, subMap]) => {
      const categoryValue = category as RootCauseCategoryValue;
      const subRows: TrendSubRow[] = Array.from(subMap.entries())
        .map(([subCategory, count]) => ({
          key: subCategory,
          label: ROOT_CAUSE_SUBCATEGORY_LABELS[categoryValue]?.[subCategory] ?? (subCategory || "Unspecified"),
          count,
        }))
        .sort((a, b) => b.count - a.count);
      return {
        key: category,
        category,
        label: ROOT_CAUSE_LABELS[categoryValue] ?? category,
        count: subRows.reduce((sum, s) => sum + s.count, 0),
        subRows,
      };
    })
    .sort((a, b) => b.count - a.count);
}

export type IncidentTypeCategoryTrend = {
  key: string;
  type: IncidentType;
  label: string;
  count: number;
  subRows: TrendSubRow[];
};

/**
 * Incident types grouped by type, each carrying its own sub-category
 * breakdown (an incident can carry more than one type, so this counts type
 * tags, not incidents) — shows which categories of incident actually
 * dominate the log, and which specific sub-category within each is driving
 * that count, the other half of the trend picture alongside root cause.
 */
export async function getIncidentTypeTrends(
  companyId: string,
  range?: { from: Date; to: Date },
): Promise<IncidentTypeCategoryTrend[]> {
  const rows = await prisma.incidentTypeEntry.findMany({
    where: {
      incident: {
        companyId,
        deletedAt: null,
        ...(range ? { occurredAt: { gte: range.from, lte: range.to } } : {}),
      },
    },
    select: { type: true, subCategory: true },
  });

  const byType = new Map<IncidentType, Map<string, number>>();
  for (const r of rows) {
    const subMap = byType.get(r.type) ?? new Map<string, number>();
    subMap.set(r.subCategory, (subMap.get(r.subCategory) ?? 0) + 1);
    byType.set(r.type, subMap);
  }

  return Array.from(byType.entries())
    .map(([type, subMap]) => {
      const typeValue = type as IncidentTypeValue;
      const subRows: TrendSubRow[] = Array.from(subMap.entries())
        .map(([subCategory, count]) => ({
          key: subCategory,
          label: INCIDENT_SUBCATEGORY_LABELS[typeValue]?.[subCategory] ?? subCategory,
          count,
        }))
        .sort((a, b) => b.count - a.count);
      return {
        key: type,
        type,
        label: INCIDENT_TYPE_LABELS[typeValue] ?? type,
        count: subRows.reduce((sum, s) => sum + s.count, 0),
        subRows,
      };
    })
    .sort((a, b) => b.count - a.count);
}
