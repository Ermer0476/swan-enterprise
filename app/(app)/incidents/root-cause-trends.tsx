"use client";

// Resolves ROOT_CAUSE_ICONS (function references) before handing them to
// DonutDrilldown — must run client-side, since a Server Component can't
// pass a component reference as a prop into a Client Component.

import { ROOT_CAUSE_ICONS, type RootCauseCategoryValue } from "@/lib/root-cause";
import { DonutDrilldown, type DrilldownCategory } from "@/components/kpi/donut-drilldown";
import type { RootCauseCategoryTrend } from "@/features/incidents/queries";

// Surfaced separately from the KPI strip because it answers a different
// question: not "how many incidents" but "which root cause keeps coming
// back" — the pattern TMSA's investigation-quality review actually checks
// for. Click a category to see its own sub-category breakdown.
export function RootCauseTrends({
  rows,
  totalIncidents,
}: {
  rows: RootCauseCategoryTrend[];
  /** Total incidents in the period (from the KPI strip above) — root cause
   * is set during investigation, not at report time, so this is usually
   * higher than the donut's own total until every incident has been
   * investigated. Explains the gap instead of leaving it looking like a
   * mismatch. */
  totalIncidents?: number;
}) {
  if (rows.length === 0) return null;

  const categories: DrilldownCategory[] = rows.map((r) => ({
    key: r.key,
    label: r.label,
    value: r.count,
    icon: ROOT_CAUSE_ICONS[r.category as RootCauseCategoryValue],
    subRows: r.subRows.map((s) => ({ key: s.key, label: s.label, value: s.count })),
  }));

  return (
    <DonutDrilldown
      categories={categories}
      unit="incidents"
      centerCaption="Investigated"
      grandTotal={totalIncidents}
      leftTitle="Root Cause Trends"
      leftDescription="Share of investigated incidents by root cause category — click one to see its sub-category breakdown."
      rightTitle="Sub-Cause Breakdown"
    />
  );
}
