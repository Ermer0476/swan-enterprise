import "server-only";
import { prisma } from "@/lib/prisma";
import type { IncidentStatus, Severity, IncidentType } from "@/lib/generated/prisma";
import {
  ROOT_CAUSE_LABELS,
  ROOT_CAUSE_SUBCATEGORY_LABELS,
  type RootCauseCategoryValue,
} from "@/lib/root-cause";
import { INCIDENT_TYPE_LABELS, INCIDENT_SUBCATEGORY_LABELS, type IncidentTypeValue } from "./schema";

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

export type IncidentKpis = {
  totalYtd: number;
  lti: number;
  trc: number;
  fatalities: number;
  openCount: number;
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
 */
export async function getIncidentKpis(companyId: string): Promise<IncidentKpis> {
  const yearStart = new Date(new Date().getFullYear(), 0, 1);

  const [all, injuryEntriesYtd, capaRows] = await Promise.all([
    prisma.incident.findMany({
      where: { companyId, deletedAt: null },
      select: { status: true, occurredAt: true, closedAt: true },
    }),
    prisma.incidentTypeEntry.findMany({
      where: {
        type: "PERSONAL_INJURY",
        incident: { companyId, deletedAt: null, occurredAt: { gte: yearStart } },
      },
      select: { subCategory: true },
    }),
    prisma.capaAction.findMany({
      where: { companyId, entityType: "Incident", deletedAt: null },
      select: { status: true },
    }),
  ]);

  const ytd = all.filter((i) => i.occurredAt >= yearStart);
  const lti = injuryEntriesYtd.filter((t) => t.subCategory === "LTI").length;
  const trc = injuryEntriesYtd.filter((t) =>
    (["MTC", "RWC", "LTI", "FATALITY"] as string[]).includes(t.subCategory),
  ).length;
  const fatalities = injuryEntriesYtd.filter((t) => t.subCategory === "FATALITY").length;

  const open = all.filter((i) => i.status !== "CLOSED");
  const now = Date.now();
  const overdueCount = open.filter(
    (i) => now - i.occurredAt.getTime() > OVERDUE_DAYS * 24 * 60 * 60 * 1000,
  ).length;

  const capaClosureRate =
    capaRows.length > 0
      ? Math.round((capaRows.filter((c) => c.status === "CLOSED").length / capaRows.length) * 100)
      : null;

  const closedYtd = ytd.filter(
    (i): i is typeof i & { closedAt: Date } => i.status === "CLOSED" && i.closedAt !== null,
  );
  const avgDaysToClose =
    closedYtd.length > 0
      ? Math.round(
          closedYtd.reduce((sum, i) => sum + (i.closedAt.getTime() - i.occurredAt.getTime()) / 86_400_000, 0) /
            closedYtd.length,
        )
      : null;

  return {
    totalYtd: ytd.length,
    lti,
    trc,
    fatalities,
    openCount: open.length,
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
export async function getIncidentRootCauseTrends(companyId: string): Promise<RootCauseCategoryTrend[]> {
  const rows = await prisma.incident.findMany({
    where: { companyId, deletedAt: null, rootCauseCategory: { not: null } },
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
export async function getIncidentTypeTrends(companyId: string): Promise<IncidentTypeCategoryTrend[]> {
  const rows = await prisma.incidentTypeEntry.findMany({
    where: { incident: { companyId, deletedAt: null } },
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
