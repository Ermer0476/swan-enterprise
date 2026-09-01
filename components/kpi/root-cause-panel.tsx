"use client";

// Root Cause drill-down for SIRE / CDI / Company Inspections' KPI pages —
// a thin domain wrapper around the generic DonutDrilldown: resolves the
// shared ROOT_CAUSE_CATEGORIES labels/icons and reshapes the flat
// byRootCause/bySubRootCause analytics shape into DonutDrilldown's
// category → sub-row tree.
//
// Marked "use client" (even though it holds no state of its own) because it
// resolves ROOT_CAUSE_ICONS into function references and hands them to
// DonutDrilldown as props — passing a component reference as a prop FROM a
// Server Component INTO a Client Component isn't serializable, so the icon
// lookup has to happen client-side, not in the server-rendered KPI pages.

import {
  ROOT_CAUSE_LABELS,
  ROOT_CAUSE_ICONS,
  ROOT_CAUSE_SUBCATEGORY_LABELS,
  type RootCauseCategoryValue,
} from "@/lib/root-cause";
import { humanize } from "@/lib/utils";
import { DonutDrilldown, type DrilldownCategory } from "@/components/kpi/donut-drilldown";

type SubRootCauseRow = { category: string; subCategory: string; count: number };

export function RootCausePanel({
  byRootCause,
  bySubRootCause,
  totalObservations,
  unit = "observations",
}: {
  byRootCause: Record<string, number>;
  bySubRootCause: SubRootCauseRow[];
  /** Grand total for the period (from the KPI tile above) — may exceed the
   * donut's own total, since not every observation has a root cause tagged
   * yet. Used to explain the gap instead of leaving it looking like a
   * mismatch. */
  totalObservations?: number;
  unit?: string;
}) {
  const categories: DrilldownCategory[] = Object.entries(byRootCause).map(([key, value]) => ({
    key,
    label: ROOT_CAUSE_LABELS[key as RootCauseCategoryValue] ?? humanize(key),
    value,
    icon: ROOT_CAUSE_ICONS[key as RootCauseCategoryValue],
    subRows: bySubRootCause
      .filter((s) => s.category === key)
      .map((s) => ({
        key: s.subCategory,
        label:
          ROOT_CAUSE_SUBCATEGORY_LABELS[key as RootCauseCategoryValue]?.[s.subCategory] ??
          (s.subCategory || "Unspecified"),
        value: s.count,
      })),
  }));

  return (
    <DonutDrilldown
      categories={categories}
      unit={unit}
      centerCaption="Root-Caused"
      grandTotal={totalObservations}
      leftTitle="Root Cause Distribution"
      rightTitle="Sub-Cause Analysis"
    />
  );
}
