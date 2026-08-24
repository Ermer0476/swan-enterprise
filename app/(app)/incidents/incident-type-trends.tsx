"use client";

// Resolves INCIDENT_TYPE_ICONS (function references) before handing them to
// DonutDrilldown — must run client-side, since a Server Component can't
// pass a component reference as a prop into a Client Component.

import { INCIDENT_TYPE_ICONS, type IncidentTypeValue } from "@/features/incidents/schema";
import { DonutDrilldown, type DrilldownCategory } from "@/components/kpi/donut-drilldown";
import type { IncidentTypeCategoryTrend } from "@/features/incidents/queries";

// The other half of the trend picture alongside root cause: which category
// of incident (Personal Injury, Navigation/Marine, Loss of Containment…)
// actually dominates the log. An incident can carry more than one type, so
// this counts type tags rather than incidents. Click a type to see its own
// sub-category breakdown (e.g. Personal Injury -> FAC/MTC/RWC/LTI/Fatality).
export function IncidentTypeTrends({ rows }: { rows: IncidentTypeCategoryTrend[] }) {
  if (rows.length === 0) return null;

  const categories: DrilldownCategory[] = rows.map((r) => ({
    key: r.key,
    label: r.label,
    value: r.count,
    icon: INCIDENT_TYPE_ICONS[r.type as IncidentTypeValue],
    subRows: r.subRows.map((s) => ({ key: s.key, label: s.label, value: s.count })),
  }));

  return (
    <DonutDrilldown
      categories={categories}
      unit="type tags"
      centerCaption="Type Tags"
      leftTitle="Incident Type Trends"
      leftDescription="Distribution of reported incidents by type — click one to see its sub-category breakdown."
      rightTitle="Sub-Category Breakdown"
    />
  );
}
