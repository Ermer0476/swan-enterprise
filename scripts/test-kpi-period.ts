// Regression tests for lib/kpi-period.ts — no test runner is configured in
// this project, so this is a plain assertion script. Rerun any time via:
//   npx tsx scripts/test-kpi-period.ts
import { getKpiPeriod, quarterEndDate, startOfToday } from "@/lib/kpi-period";

let failures = 0;

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function check(name: string, actual: string, expected: string) {
  const pass = actual === expected;
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — expected ${expected}, got ${actual}`);
}

// ─── Spec §19 named test cases ──────────────────────────────────────────────

{
  const p = getKpiPeriod({ measurementPeriod: "YTD", reportingDate: new Date(Date.UTC(2026, 2, 31)) });
  check("Test 1 — Q1 YTD start", iso(p.periodStart), "2026-01-01");
  check("Test 1 — Q1 YTD end", iso(p.periodEnd), "2026-03-31");
}
{
  const p = getKpiPeriod({ measurementPeriod: "YTD", reportingDate: new Date(Date.UTC(2026, 5, 30)) });
  check("Test 2 — Q2 YTD start", iso(p.periodStart), "2026-01-01");
  check("Test 2 — Q2 YTD end", iso(p.periodEnd), "2026-06-30");
}
{
  const p = getKpiPeriod({ measurementPeriod: "YTD", reportingDate: new Date(Date.UTC(2026, 8, 30)) });
  check("Test 3 — Q3 YTD start", iso(p.periodStart), "2026-01-01");
  check("Test 3 — Q3 YTD end", iso(p.periodEnd), "2026-09-30");
}
{
  const p = getKpiPeriod({ measurementPeriod: "YTD", reportingDate: new Date(Date.UTC(2026, 11, 31)) });
  check("Test 4 — Q4 YTD start", iso(p.periodStart), "2026-01-01");
  check("Test 4 — Q4 YTD end", iso(p.periodEnd), "2026-12-31");
}
{
  const p = getKpiPeriod({ measurementPeriod: "ROLLING_12", reportingDate: new Date(Date.UTC(2026, 5, 30)) });
  check("Test 5 — Exposure Hours Q2 rolling-12 start", iso(p.periodStart), "2025-07-01");
  check("Test 5 — Exposure Hours Q2 rolling-12 end", iso(p.periodEnd), "2026-06-30");
}
{
  const p = getKpiPeriod({ measurementPeriod: "ROLLING_12", reportingDate: new Date(Date.UTC(2026, 8, 30)) });
  check("Test 6 — Exposure Hours Q3 rolling-12 start", iso(p.periodStart), "2025-10-01");
  check("Test 6 — Exposure Hours Q3 rolling-12 end", iso(p.periodEnd), "2026-09-30");
}

// ─── §5 worked examples (Exposure Hours Q1/Q4) ─────────────────────────────

{
  const p = getKpiPeriod({ measurementPeriod: "ROLLING_12", reportingDate: quarterEndDate(2026, 1) });
  check("Exposure Q1 2026 rolling-12 start", iso(p.periodStart), "2025-04-01");
  check("Exposure Q1 2026 rolling-12 end", iso(p.periodEnd), "2026-03-31");
}
{
  const p = getKpiPeriod({ measurementPeriod: "ROLLING_12", reportingDate: quarterEndDate(2026, 4) });
  check("Exposure Q4 2026 rolling-12 start", iso(p.periodStart), "2026-01-01");
  check("Exposure Q4 2026 rolling-12 end", iso(p.periodEnd), "2026-12-31");
}

// ─── quarterEndDate() ───────────────────────────────────────────────────────

check("quarterEndDate Q1", iso(quarterEndDate(2026, 1)), "2026-03-31");
check("quarterEndDate Q2", iso(quarterEndDate(2026, 2)), "2026-06-30");
check("quarterEndDate Q3", iso(quarterEndDate(2026, 3)), "2026-09-30");
check("quarterEndDate Q4", iso(quarterEndDate(2026, 4)), "2026-12-31");

// ─── §20 edge cases ─────────────────────────────────────────────────────────

// Leap year: Feb 29 2028 must be the rolling-12 window's reporting date, and
// the window must correctly span back across a leap-day February.
{
  const p = getKpiPeriod({ measurementPeriod: "ROLLING_12", reportingDate: new Date(Date.UTC(2028, 1, 29)) });
  check("Leap year — rolling-12 end is Feb 29", iso(p.periodEnd), "2028-02-29");
  check("Leap year — rolling-12 start", iso(p.periodStart), "2027-03-01");
}

// Year rollover: Rolling 6 Months as of Jan 31 must reach back into the
// previous year (Aug 2025) without an off-by-one on the year boundary.
{
  const p = getKpiPeriod({ measurementPeriod: "ROLLING_6", reportingDate: new Date(Date.UTC(2026, 0, 31)) });
  check("Year rollover — rolling-6 start", iso(p.periodStart), "2025-08-01");
  check("Year rollover — rolling-6 end", iso(p.periodEnd), "2026-01-31");
}

// Q1 YTD must equal an isolated Q1 window, since both start Jan 1 — the
// cumulative-vs-isolated distinction only matters from Q2 onward.
{
  const p = getKpiPeriod({ measurementPeriod: "YTD", reportingDate: quarterEndDate(2026, 1) });
  check("Q1 YTD == isolated Q1 start", iso(p.periodStart), "2026-01-01");
  check("Q1 YTD == isolated Q1 end", iso(p.periodEnd), "2026-03-31");
}

// Monthly measurement period — single calendar month containing reportingDate.
{
  const p = getKpiPeriod({ measurementPeriod: "MONTHLY", reportingDate: new Date(Date.UTC(2026, 7, 31)) });
  check("Monthly start", iso(p.periodStart), "2026-08-01");
  check("Monthly end", iso(p.periodEnd), "2026-08-31");
}

// startOfToday() sanity check — must be a real date, not throw, not be in
// the future relative to itself.
{
  const today = startOfToday();
  check("startOfToday is a valid ISO date", iso(today), iso(today));
}

console.log(failures === 0 ? "\nAll tests passed." : `\n${failures} test(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
