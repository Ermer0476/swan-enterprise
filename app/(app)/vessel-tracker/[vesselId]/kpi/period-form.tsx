"use client";

import { useState } from "react";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Monthly/Quarterly/Yearly period picker for the KPI dashboard — swaps the
 * Month vs Quarter control based on the chosen granularity, but stays a
 * plain GET form (same as every other filter in this app) so the actual
 * date-range math lives server-side in page.tsx, not duplicated here. */
export function PeriodForm({
  years,
  year,
  period,
  month,
  quarter,
}: {
  years: number[];
  year: number;
  period: "month" | "quarter" | "year";
  month: number;
  quarter: number;
}) {
  const [selectedPeriod, setSelectedPeriod] = useState(period);

  return (
    <form className="mb-6 flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Year</label>
        <Select name="year" defaultValue={String(year)} className="w-28">
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </Select>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Period</label>
        <Select name="period" value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value as typeof period)} className="w-32">
          <option value="month">Monthly</option>
          <option value="quarter">Quarterly</option>
          <option value="year">Yearly</option>
        </Select>
      </div>
      {selectedPeriod === "month" && (
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Month</label>
          <Select name="month" defaultValue={String(month)} className="w-40">
            {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </Select>
        </div>
      )}
      {selectedPeriod === "quarter" && (
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Quarter</label>
          <Select name="quarter" defaultValue={String(quarter)} className="w-40">
            <option value="1">Q1 (Jan–Mar)</option>
            <option value="2">Q2 (Apr–Jun)</option>
            <option value="3">Q3 (Jul–Sep)</option>
            <option value="4">Q4 (Oct–Dec)</option>
          </Select>
        </div>
      )}
      <Button type="submit" variant="outline">Apply</Button>
    </form>
  );
}
