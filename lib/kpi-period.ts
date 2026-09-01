// Shared KPI Period Service — turns (measurementPeriod, reportingDate) into a
// concrete [periodStart, periodEnd] date range. This is the ONLY place that
// knows how to compute a reporting window; every module keeps owning its own
// KPI formula (counts, averages, frequencies) and just asks this service
// "what date range should I use?" See docs/ARCHITECTURE.md-adjacent modules
// under features/*/queries.ts for how each one wires this in.
//
// Deliberately dependency-free (no "server-only", no Prisma) so it's safe to
// import from both client and server code.

export const MEASUREMENT_PERIODS = ["MONTHLY", "YTD", "ROLLING_6", "ROLLING_12"] as const;
export type MeasurementPeriod = (typeof MEASUREMENT_PERIODS)[number];
export const MEASUREMENT_PERIOD_LABELS: Record<MeasurementPeriod, string> = {
  MONTHLY: "Monthly",
  YTD: "YTD",
  ROLLING_6: "Rolling 6 Months",
  ROLLING_12: "Rolling 12 Months",
};

export const REVIEW_FREQUENCIES = ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL"] as const;
export type ReviewFrequency = (typeof REVIEW_FREQUENCIES)[number];
export const REVIEW_FREQUENCY_LABELS: Record<ReviewFrequency, string> = {
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  SEMI_ANNUAL: "Semi-Annual",
  ANNUAL: "Annual",
};

export type KpiPeriod = {
  periodStart: Date; // inclusive
  periodEnd: Date; // inclusive
  periodLabel: string;
  quarter: number; // 1-4, the calendar quarter reportingDate falls in
  year: number;
};

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Encodes a LOCAL calendar date (year/month/day, month 0-indexed) as UTC
// midnight. This is the one correct representation for comparing against
// DateTime columns populated from <input type="date"> values — those parse
// as UTC midnight of the typed calendar date (ECMAScript date-only string
// parsing is always UTC), so a boundary must be built the same way or an
// inclusive upper bound silently drops same-day data for part of the day in
// any timezone ahead of UTC (confirmed this session: Manila, UTC+8, loses up
// to 8 hours' worth of "today" every day if a boundary is built via the raw
// local `new Date(y, m, d)` constructor instead of this).
function localDateUTC(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

/** Today's LOCAL calendar date, UTC-midnight-encoded — see localDateUTC. */
export function startOfToday(): Date {
  const now = new Date();
  return localDateUTC(now.getFullYear(), now.getMonth(), now.getDate());
}

/** A future quarter-end (the current, still-in-progress quarter) reads as
 * "today" instead — showing e.g. "Q3 2026: Jul 1 – Sep 30" while it's still
 * August would misleadingly imply September data that doesn't exist yet. */
export function clampToToday(d: Date): Date {
  const today = startOfToday();
  return d > today ? today : d;
}

function lastDayOfMonth(year: number, month: number): Date {
  // Day 0 of the following month rolls back to the last day of `month`.
  return localDateUTC(year, month + 1, 0);
}

function addMonths(d: Date, months: number): { year: number; month: number } {
  const total = d.getUTCFullYear() * 12 + d.getUTCMonth() + months;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

function quarterOf(month0: number): number {
  return Math.floor(month0 / 3) + 1;
}

function formatLabel(start: Date, end: Date): string {
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const startLabel = `${MONTH_ABBR[start.getUTCMonth()]}${sameYear ? "" : ` ${start.getUTCFullYear()}`}`;
  const endLabel = `${MONTH_ABBR[end.getUTCMonth()]} ${end.getUTCFullYear()}`;
  return `${startLabel} – ${endLabel}`;
}

/** Q1→Mar 31, Q2→Jun 30, Q3→Sep 30, Q4→Dec 31 (inclusive) — the reporting
 * date a Year+Quarter picker resolves to for a Quarterly review frequency. */
export function quarterEndDate(year: number, quarter: 1 | 2 | 3 | 4): Date {
  return lastDayOfMonth(year, quarter * 3 - 1);
}

/** Resolves a measurement period to a concrete [periodStart, periodEnd]
 * ending at (and including) reportingDate. reviewFrequency is accepted for
 * API fidelity with the spec this implements but doesn't affect the math —
 * it only governs which reportingDate a caller's UI lets the user pick
 * (e.g. a Quarterly review frequency → a Year+Quarter selector feeding
 * quarterEndDate() in as reportingDate). */
export function getKpiPeriod(args: {
  measurementPeriod: MeasurementPeriod;
  reportingDate: Date;
  reviewFrequency?: ReviewFrequency;
}): KpiPeriod {
  const { measurementPeriod, reportingDate } = args;
  const y = reportingDate.getUTCFullYear();
  const m = reportingDate.getUTCMonth();
  const periodEnd = reportingDate;

  let periodStart: Date;
  switch (measurementPeriod) {
    case "MONTHLY":
      periodStart = localDateUTC(y, m, 1);
      break;
    case "YTD":
      periodStart = localDateUTC(y, 0, 1);
      break;
    case "ROLLING_6": {
      const s = addMonths(reportingDate, -5);
      periodStart = localDateUTC(s.year, s.month, 1);
      break;
    }
    case "ROLLING_12": {
      const s = addMonths(reportingDate, -11);
      periodStart = localDateUTC(s.year, s.month, 1);
      break;
    }
  }

  return {
    periodStart,
    periodEnd,
    periodLabel: formatLabel(periodStart, periodEnd),
    quarter: quarterOf(m),
    year: y,
  };
}
