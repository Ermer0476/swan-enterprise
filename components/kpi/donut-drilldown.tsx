"use client";

// Generic two-panel donut drill-down: a big donut for the category
// breakdown on the left, and a click-filtered sub-category bar list on the
// right. Clicking a category (ring segment, legend row, or pill) filters
// the right panel to that category's sub-rows; "All" shows every sub-row
// across categories. Domain-agnostic — callers resolve labels/icons/colors
// and hand over plain data, so the same panel serves root cause breakdowns,
// incident type breakdowns, or any other category → sub-category trend.

import { useState } from "react";
import { PieChart, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart, paletteColor, type BarDatum } from "@/components/ui/bar-chart";
import { DonutChart, type DonutDatum } from "@/components/ui/donut-chart";

export type DrilldownSubRow = { key: string; label: string; value: number };
export type DrilldownCategory = {
  key: string;
  label: string;
  value: number;
  color?: string;
  icon?: LucideIcon;
  subRows: DrilldownSubRow[];
};

export function DonutDrilldown({
  categories,
  unit = "entries",
  centerCaption,
  grandTotal,
  leftTitle = "Distribution",
  leftDescription = "Breakdown by category — click a slice to drill down.",
  rightTitle = "Breakdown",
}: {
  categories: DrilldownCategory[];
  unit?: string;
  /** Center-of-donut caption. Defaults to "Total {unit}" — override when the
   * donut's total can fall short of a true grand total (e.g. only rows that
   * have been categorized so far) so it doesn't read as a mismatch. */
  centerCaption?: string;
  /** True total across all rows, including uncategorized ones. When it
   * exceeds the sum of category values, a note explains the gap instead of
   * leaving it looking like an error. */
  grandTotal?: number;
  leftTitle?: string;
  leftDescription?: string;
  rightTitle?: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  if (categories.length === 0) return null;

  const sorted = [...categories]
    .sort((a, b) => b.value - a.value)
    .map((c, i) => ({ ...c, color: c.color ?? paletteColor(i) }));

  const donutData: DonutDatum[] = sorted.map((c) => ({ label: c.label, value: c.value, color: c.color }));
  const categorizedCount = sorted.reduce((s, c) => s + c.value, 0);
  const uncategorizedCount = grandTotal != null ? Math.max(0, grandTotal - categorizedCount) : 0;

  const selectedCategory = sorted.find((c) => c.label === selected);

  const subCauseData: BarDatum[] = (selectedCategory ? [selectedCategory] : sorted)
    .flatMap((c) => c.subRows.map((s) => ({ label: s.label, value: s.value, color: c.color, icon: c.icon })))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardContent className="pt-5">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <PieChart className="h-4 w-4 text-accent" /> {leftTitle}
          </div>
          <p className="mb-5 text-xs text-muted-foreground">{leftDescription}</p>
          <DonutChart
            title={centerCaption ?? `Total ${unit}`}
            data={donutData}
            size={240}
            thickness={44}
            sliceLabels
            legendShowPercent={false}
            selectedLabel={selected}
            onSliceClick={(label) => setSelected((cur) => (cur === label ? null : label))}
          />
          {uncategorizedCount > 0 && (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              {uncategorizedCount} of {grandTotal} {unit} not yet categorized.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <PieChart className="h-4 w-4 text-accent" /> {rightTitle}
          </div>
          <p className="mb-4 text-xs text-muted-foreground">
            {selectedCategory ? `Detailed breakdown for ${selectedCategory.label}.` : "Detailed breakdown across all categories."}
          </p>

          <div className="mb-5 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                selected === null ? "bg-accent text-accent-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              All
            </button>
            {sorted.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setSelected((cur) => (cur === c.label ? null : c.label))}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  selected === c.label ? "bg-accent text-accent-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {subCauseData.length > 0 ? (
            <BarChart data={subCauseData} unit={`${unit}${selectedCategory ? ` in ${selectedCategory.label}` : ""}`} />
          ) : (
            <p className="text-sm text-muted-foreground">No sub-category detail recorded for this selection yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
