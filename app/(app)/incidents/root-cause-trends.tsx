import { DonutTrendCard, type DonutRow } from "./donut-trend-card";
import type { RootCauseCategoryTrend } from "@/features/incidents/queries";

// Surfaced separately from the KPI strip because it answers a different
// question: not "how many incidents" but "which root cause keeps coming
// back" — the pattern TMSA's investigation-quality review actually checks
// for. Click a category to see its own sub-category breakdown.
export function RootCauseTrends({ rows }: { rows: RootCauseCategoryTrend[] }) {
  const donutRows: DonutRow[] = rows.map((r) => ({
    key: r.key,
    label: r.label,
    count: r.count,
    subRows: r.subRows,
  }));

  return (
    <DonutTrendCard
      title="Root Cause Trends"
      description="Share of investigated incidents by root cause category — click one to see its sub-category breakdown."
      rows={donutRows}
      centerSubLabel="investigated"
      overflowNoun="categories"
    />
  );
}
