"use client";

import { useState } from "react";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR + 1 - i);

// Quarters here are cumulative year-to-date, matching how TMSA/OCIMF safety
// KPIs (LTIF/TRCF) are conventionally reported — Q2 means Jan through Jun,
// not just Apr-Jun, since isolated 3-month windows get statistically noisy
// with typically low incident counts.
const PERIODS: { value: string; label: string; endMonth: number }[] = [
  { value: "FULL", label: "Full Year", endMonth: 12 },
  { value: "Q1", label: "Q1 (Jan–Mar)", endMonth: 3 },
  { value: "Q2", label: "Q2 (Jan–Jun)", endMonth: 6 },
  { value: "Q3", label: "Q3 (Jan–Sep)", endMonth: 9 },
  { value: "Q4", label: "Q4 (Jan–Dec)", endMonth: 12 },
];

// Local calendar date, not toISOString() (UTC) — otherwise "today" reads as
// yesterday for up to 8 hours a day in Manila (UTC+8), clamping period end
// dates one day too early.
function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// A period that hasn't finished yet (e.g. picking Q3 while it's still
// August) gets clamped to today — the underlying totals are already capped
// server-side, but showing "To: Sep 30" would misleadingly imply September
// data that doesn't exist yet.
function periodRange(year: number, periodValue: string): { from: string; to: string } | null {
  const period = PERIODS.find((p) => p.value === periodValue);
  if (!period) return null;
  const from = `${year}-01-01`;
  const lastDay = new Date(Date.UTC(year, period.endMonth, 0)).getUTCDate();
  const computedTo = `${year}-${String(period.endMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const to = computedTo > todayStr() ? todayStr() : computedTo;
  return { from, to };
}

function yearFromDate(date: string | undefined): string {
  if (!date) return String(CURRENT_YEAR);
  const year = date.slice(0, 4);
  return year || String(CURRENT_YEAR);
}

export function DateRangeFilter({
  defaultFrom,
  defaultTo,
  extraFields,
}: {
  defaultFrom?: string;
  defaultTo?: string;
  extraFields?: React.ReactNode;
}) {
  const [from, setFrom] = useState(defaultFrom ?? "");
  const [to, setTo] = useState(defaultTo ?? "");
  const [year, setYear] = useState(yearFromDate(defaultFrom));
  const [period, setPeriod] = useState("");

  function applyPeriod(nextYear: string, nextPeriod: string) {
    setYear(nextYear);
    setPeriod(nextPeriod);
    const range = periodRange(Number(nextYear), nextPeriod);
    if (range) {
      setFrom(range.from);
      setTo(range.to);
    }
  }

  function clearQuickPick() {
    setPeriod("");
  }

  return (
    <form className="flex flex-wrap items-end gap-2">
      {extraFields}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Year</label>
        <Select value={year} onChange={(e) => applyPeriod(e.target.value, period || "FULL")} className="w-24">
          {YEARS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </Select>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Period</label>
        <Select value={period} onChange={(e) => applyPeriod(year, e.target.value)} className="w-36">
          <option value="">Custom</option>
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </Select>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">From</label>
        <Input
          name="from"
          type="date"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            clearQuickPick();
          }}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">To</label>
        <Input
          name="to"
          type="date"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            clearQuickPick();
          }}
        />
      </div>
      <Button type="submit">Filter</Button>
    </form>
  );
}
