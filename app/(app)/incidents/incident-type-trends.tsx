import { DonutTrendCard, type DonutRow } from "./donut-trend-card";
import type { IncidentTypeCategoryTrend } from "@/features/incidents/queries";

// The other half of the trend picture alongside root cause: which category
// of incident (Personal Injury, Navigation/Marine, Loss of Containment…)
// actually dominates the log. An incident can carry more than one type, so
// this counts type tags rather than incidents. Click a type to see its own
// sub-category breakdown (e.g. Personal Injury -> FAC/MTC/RWC/LTI/Fatality).
export function IncidentTypeTrends({ rows }: { rows: IncidentTypeCategoryTrend[] }) {
  const donutRows: DonutRow[] = rows.map((r) => ({
    key: r.key,
    label: r.label,
    count: r.count,
    subRows: r.subRows,
  }));

  return (
    <DonutTrendCard
      title="Incident Type Trends"
      description="Distribution of reported incidents by type — click one to see its sub-category breakdown."
      rows={donutRows}
      centerSubLabel="type tags"
      overflowNoun="types"
    />
  );
}
