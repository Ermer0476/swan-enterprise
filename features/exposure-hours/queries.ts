import "server-only";
import { prisma } from "@/lib/prisma";
import { getKpiPeriod, startOfToday } from "@/lib/kpi-period";
import {
  computeLti,
  computeTrc,
  computeFrequency,
  computeHoursFromCrewEntries,
  tallyClassifications,
  DEFAULT_LTIF_TARGET,
  DEFAULT_TRCF_TARGET,
  type ExposureCounts,
  type CrewEntryInput,
  type SummaryPeriodKey,
} from "./schema";

export type ExposurePeriodFilter = { from?: Date; to?: Date };

type Totals = ExposureCounts & { totalHours: number };

function emptyTotals(): Totals {
  return { fat: 0, ptd: 0, ppd: 0, lwc: 0, rwc: 0, mtc: 0, totalHours: 0 };
}

function withDerived(t: Totals) {
  const lti = computeLti(t);
  const trc = computeTrc(t);
  return { ...t, lti, trc, ltif: computeFrequency(lti, t.totalHours), trcf: computeFrequency(trc, t.totalHours) };
}

function earliestEffectiveFrom(entries: { effectiveFrom: Date }[]): Date | null {
  return entries.reduce<Date | null>((min, e) => (!min || e.effectiveFrom < min ? e.effectiveFrom : min), null);
}

// Exposure Hours pages default to the current calendar year (not all-time)
// when no explicit date filter is in the URL — comparing vessels "all time"
// mixes in however far back each one's crew history happens to start, which
// makes otherwise-identical vessels look different for no operational reason.
export function defaultYearRange(): { from: Date; to: Date } {
  const currentYear = new Date().getFullYear();
  return { from: new Date(Date.UTC(currentYear, 0, 1)), to: new Date(Date.UTC(currentYear, 11, 31)) };
}

/** Resolves one of the Exposure Summary Period selector's buckets to a
 * concrete [from, to] range, always ending today — Monthly/Quarterly/YTD
 * are "so far this calendar period," Rolling 12 Months is the trailing-12
 * window (the maritime-standard way to report LTIF/TRCF, and the default),
 * Annual is the full current calendar year. */
export function resolveSummaryPeriodRange(period: SummaryPeriodKey): { from: Date; to: Date } {
  const today = startOfToday();
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  switch (period) {
    case "MONTHLY":
      return { from: new Date(Date.UTC(y, m, 1)), to: today };
    case "QUARTERLY":
      return { from: new Date(Date.UTC(y, Math.floor(m / 3) * 3, 1)), to: today };
    case "YTD":
      return { from: new Date(Date.UTC(y, 0, 1)), to: today };
    case "ROLLING_12":
      return { from: new Date(Date.UTC(y, m - 11, 1)), to: today };
    case "ANNUAL":
      return { from: new Date(Date.UTC(y, 0, 1)), to: new Date(Date.UTC(y, 11, 31)) };
  }
}

// Once a vessel leaves the fleet (sold — see Vessel.archivedAt), its crew
// roster stops accruing exposure hours as of that date. Without this cap,
// an archived vessel's "all time" total would keep growing every day even
// though no one has been reporting for it since it left.
function effectiveRangeTo(filterTo: Date | undefined, archivedAt: Date | null, today: Date): Date {
  const cap = archivedAt && archivedAt < today ? archivedAt : today;
  return filterTo && filterTo < cap ? filterTo : cap;
}

function caseOverlapsFilter(filter: ExposurePeriodFilter) {
  if (!filter.from && !filter.to) return {};
  return {
    occurredOn: {
      ...(filter.from ? { gte: filter.from } : {}),
      ...(filter.to ? { lte: filter.to } : {}),
    },
  };
}

/** Fleet-wide per-vessel exposure hours summary for a date range (or
 * all-time if unset), plus a fleet total row — the office "Summary" view.
 * Total hours are computed live from each vessel's crew roster, not stored. */
export async function listExposureSummary(
  companyId: string,
  filters: { vesselId?: string } & ExposurePeriodFilter,
) {
  const vessels = await prisma.vessel.findMany({
    where: {
      companyId,
      deletedAt: null,
      status: "ACTIVE",
      ...(filters.vesselId ? { id: filters.vesselId } : {}),
    },
    select: { id: true, name: true, archivedAt: true },
    orderBy: { name: "asc" },
  });

  const vesselIds = vessels.map((v) => v.id);
  const [crewEntries, cases] = await Promise.all([
    prisma.exposureCrewEntry.findMany({
      where: { companyId, vesselId: { in: vesselIds }, deletedAt: null },
      select: { vesselId: true, crew: true, effectiveFrom: true },
    }),
    prisma.exposureInjuryCase.findMany({
      where: { companyId, vesselId: { in: vesselIds }, deletedAt: null, ...caseOverlapsFilter(filters) },
      select: { vesselId: true, classification: true },
    }),
  ]);

  const today = startOfToday();
  const entriesByVessel = new Map<string, CrewEntryInput[]>();
  for (const e of crewEntries) {
    const list = entriesByVessel.get(e.vesselId) ?? [];
    list.push({ crew: e.crew, effectiveFrom: e.effectiveFrom });
    entriesByVessel.set(e.vesselId, list);
  }
  const casesByVessel = new Map<string, { classification: string }[]>();
  for (const c of cases) {
    const list = casesByVessel.get(c.vesselId) ?? [];
    list.push({ classification: c.classification });
    casesByVessel.set(c.vesselId, list);
  }

  const rows = vessels.map((v) => {
    const entries = entriesByVessel.get(v.id) ?? [];
    const rangeFrom = filters.from ?? earliestEffectiveFrom(entries) ?? today;
    const rangeTo = effectiveRangeTo(filters.to, v.archivedAt, today);
    const totalHours = computeHoursFromCrewEntries(entries, rangeFrom, rangeTo);
    const counts = tallyClassifications(casesByVessel.get(v.id) ?? []);
    return { vesselId: v.id, vesselName: v.name, ...withDerived({ ...counts, totalHours }) };
  });

  const grand = rows.reduce<Totals>(
    (acc, r) => ({
      fat: acc.fat + r.fat,
      ptd: acc.ptd + r.ptd,
      ppd: acc.ppd + r.ppd,
      lwc: acc.lwc + r.lwc,
      rwc: acc.rwc + r.rwc,
      mtc: acc.mtc + r.mtc,
      totalHours: acc.totalHours + r.totalHours,
    }),
    emptyTotals(),
  );

  return { rows, total: withDerived(grand) };
}

/** A single vessel's crew roster + injury cases + live-computed totals — the
 * "Exposure Hours - Vessel Records" view. No monthly submission: crew count
 * changes and injury cases are logged independently, and total hours for the
 * requested range (or all-time, if unset) is derived from the crew roster.
 * The Crew Roster AND Injury Cases tables are always the full ledger —
 * exactly like the Crew Roster panel, a case logged with a date outside the
 * page's currently selected filter must still show up in the list, or it
 * looks like the entry silently vanished. Only the FAT/PTD/.../LTIF/TRCF
 * totals are scoped to the selected date range. */
export async function getVesselExposureDetail(companyId: string, vesselId: string, filters: ExposurePeriodFilter) {
  const [vessel, crewEntries, cases] = await Promise.all([
    prisma.vessel.findFirst({ where: { id: vesselId, companyId }, select: { archivedAt: true } }),
    prisma.exposureCrewEntry.findMany({
      where: { companyId, vesselId, deletedAt: null },
      orderBy: { effectiveFrom: "desc" },
    }),
    prisma.exposureInjuryCase.findMany({
      where: { companyId, vesselId, deletedAt: null },
      orderBy: { occurredOn: "desc" },
    }),
  ]);

  const today = startOfToday();
  const entryInputs: CrewEntryInput[] = crewEntries.map((e) => ({ crew: e.crew, effectiveFrom: e.effectiveFrom }));
  const rangeFrom = filters.from ?? earliestEffectiveFrom(crewEntries) ?? today;
  const rangeTo = effectiveRangeTo(filters.to, vessel?.archivedAt ?? null, today);
  const totalHours = computeHoursFromCrewEntries(entryInputs, rangeFrom, rangeTo);

  const casesInRange = cases.filter(
    (c) => (!filters.from || c.occurredOn >= filters.from) && (!filters.to || c.occurredOn <= filters.to),
  );
  const counts = tallyClassifications(casesInRange);
  const totals = withDerived({ ...counts, totalHours });

  // crewEntries is sorted effectiveFrom desc, so the first row is the
  // latest known crew count.
  const currentCrew = crewEntries[0]?.crew ?? 0;

  return { crewEntries, cases, currentCrew, totals };
}

export type KpiDashboardTotals = { totalHours: number; lti: number; trc: number; ltif: number; trcf: number };
export type KpiMonthPoint = {
  label: string;
  totalHours: number;
  lti: number;
  trc: number;
  ltif: number | null;
  trcf: number | null;
};

// Local helpers for stepping the 12-point monthly trend backward one month
// at a time — distinct from period *resolution* (that's lib/kpi-period.ts),
// this is just "which months go on the x-axis."
function monthsBeforeStart(end: Date, monthsBack: number): Date {
  return new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - monthsBack, 1));
}

function lastDayOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
}

const TREND_MONTHS = 12;

/** Rolling 12-Month LTIF/TRCF dashboard — the maritime-industry-standard way
 * to report these KPIs: rather than resetting every Jan 1 (which makes Q1
 * look artificially clean and starves low-incident-count months of a
 * meaningful denominator), every figure is "the trailing 12 months ending
 * on reportingDate" (default: today — the live view). Measurement period is
 * ROLLING_12, resolved via the shared KPI Period Service (lib/kpi-period.ts)
 * so Exposure Hours uses the exact same period math as every other module's
 * KPI dashboard, while keeping its own Rolling-12 business rule untouched.
 * previousTotals = the prior rolling 12-month block, for the "vs previous
 * 12 months" deltas; monthly = each of the last TREND_MONTHS months' OWN
 * trailing-12-month rate ending on reportingDate, so the trend line shows
 * how the rolling KPI itself has moved over time. Months that haven't
 * started yet (relative to reportingDate) get null rates so the line stops
 * instead of dropping to 0. */
export async function getRollingKpiDashboard(
  companyId: string,
  params: { vesselId?: string; reportingDate?: Date },
): Promise<{ totals: KpiDashboardTotals; previousTotals: KpiDashboardTotals; monthly: KpiMonthPoint[]; asOf: Date }> {
  const today = startOfToday();
  // Defensive clamp — the UI already clamps a future quarter-end to today,
  // but a historical reportingDate must never be trusted to exceed "now".
  const asOf = params.reportingDate && params.reportingDate < today ? params.reportingDate : today;
  const { vesselId } = params;

  const vessels = await prisma.vessel.findMany({
    where: { companyId, deletedAt: null, status: "ACTIVE", ...(vesselId ? { id: vesselId } : {}) },
    select: { id: true, archivedAt: true },
  });
  const vesselIds = vessels.map((v) => v.id);
  const archivedByVessel = new Map(vessels.map((v) => [v.id, v.archivedAt]));

  // Earliest data any point on the chart could possibly need: the oldest
  // trend point's own 12-month lookback, from the oldest trend month.
  const earliestFrom = monthsBeforeStart(asOf, TREND_MONTHS - 1 + 11);

  const [crewEntries, cases] = await Promise.all([
    prisma.exposureCrewEntry.findMany({
      where: { companyId, vesselId: { in: vesselIds }, deletedAt: null },
      select: { vesselId: true, crew: true, effectiveFrom: true },
    }),
    prisma.exposureInjuryCase.findMany({
      where: { companyId, vesselId: { in: vesselIds }, deletedAt: null, occurredOn: { gte: earliestFrom, lte: asOf } },
      select: { classification: true, occurredOn: true },
    }),
  ]);

  const entriesByVessel = new Map<string, CrewEntryInput[]>();
  for (const e of crewEntries) {
    const list = entriesByVessel.get(e.vesselId) ?? [];
    list.push({ crew: e.crew, effectiveFrom: e.effectiveFrom });
    entriesByVessel.set(e.vesselId, list);
  }

  function hoursForRange(rangeFrom: Date, rangeTo: Date): number {
    let hours = 0;
    for (const vid of vesselIds) {
      const cap = effectiveRangeTo(rangeTo, archivedByVessel.get(vid) ?? null, asOf);
      hours += computeHoursFromCrewEntries(entriesByVessel.get(vid) ?? [], rangeFrom, cap);
    }
    return hours;
  }

  function totalsForRange(rangeFrom: Date, rangeTo: Date): KpiDashboardTotals {
    const totalHours = hoursForRange(rangeFrom, rangeTo);
    const rangeCases = cases.filter((c) => c.occurredOn >= rangeFrom && c.occurredOn <= rangeTo);
    const counts = tallyClassifications(rangeCases);
    const lti = computeLti(counts);
    const trc = computeTrc(counts);
    return { totalHours, lti, trc, ltif: computeFrequency(lti, totalHours), trcf: computeFrequency(trc, totalHours) };
  }

  // Current rolling 12 months ending on reportingDate.
  const currentPeriod = getKpiPeriod({ measurementPeriod: "ROLLING_12", reportingDate: asOf });
  const totals = totalsForRange(currentPeriod.periodStart, currentPeriod.periodEnd);

  // Previous rolling 12-month block: the 12 months immediately before that.
  const prevRollingTo = new Date(currentPeriod.periodStart.getTime() - 24 * 60 * 60 * 1000);
  const prevPeriod = getKpiPeriod({ measurementPeriod: "ROLLING_12", reportingDate: prevRollingTo });
  const previousTotals = totalsForRange(prevPeriod.periodStart, prevPeriod.periodEnd);

  const monthly: KpiMonthPoint[] = [];
  for (let i = TREND_MONTHS - 1; i >= 0; i--) {
    const monthStart = monthsBeforeStart(asOf, i);
    const label = monthStart.toLocaleString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });

    if (monthStart > asOf) {
      monthly.push({ label, totalHours: 0, lti: 0, trc: 0, ltif: null, trcf: null });
      continue;
    }
    // This month's own trailing-12-month window, capped to reportingDate
    // for the current (possibly partial) month.
    const pointEnd = i === 0 ? asOf : lastDayOfMonth(monthStart);
    const pointPeriod = getKpiPeriod({ measurementPeriod: "ROLLING_12", reportingDate: pointEnd });
    const m = totalsForRange(pointPeriod.periodStart, pointEnd);
    monthly.push({ label, totalHours: m.totalHours, lti: m.lti, trc: m.trc, ltif: m.ltif, trcf: m.trcf });
  }

  return { totals, previousTotals, monthly, asOf };
}

export async function getExposureKpiTargets(companyId: string): Promise<{ ltifTarget: number; trcfTarget: number }> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { ltifTarget: true, trcfTarget: true },
  });
  return { ltifTarget: company?.ltifTarget ?? DEFAULT_LTIF_TARGET, trcfTarget: company?.trcfTarget ?? DEFAULT_TRCF_TARGET };
}

export async function getVessel(
  companyId: string,
  vesselId: string,
  isShipboard = false,
  ownVesselId?: string | null,
) {
  return prisma.vessel.findFirst({
    where: {
      id: vesselId,
      companyId,
      deletedAt: null,
      ...(isShipboard ? { AND: [{ id: ownVesselId ?? "__no-vessel-assigned__" }] } : {}),
    },
    select: { id: true, name: true, status: true, archivedAt: true, deliveryDate: true, totalComplement: true },
  });
}

export async function listVesselOptions(companyId: string) {
  return prisma.vessel.findMany({
    where: { companyId, deletedAt: null, status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
