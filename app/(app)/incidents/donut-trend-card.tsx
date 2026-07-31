"use client";

import { useState } from "react";
import { AlertCircle, ChevronRight, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Fixed categorical palette (not the semantic success/warning/danger tokens,
// which mean status elsewhere in the app) — enough distinct hues to tell
// slices apart at a glance, with a neutral gray reserved for the "Other"
// overflow bucket so it doesn't visually compete with real categories.
const SLICE_COLORS = ["#2563eb", "#059669", "#d97706", "#7c3aed", "#db2777", "#0891b2"];
const OTHER_COLOR = "#9ca3af";
const MAX_SLICES = 6;

export type DonutSubRow = { key: string; label: string; count: number };
export type DonutRow = { key: string; label: string; count: number; subRows?: DonutSubRow[] };

type Slice = DonutRow & { color: string };

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

function donutSlicePath(cx: number, cy: number, rOuter: number, rInner: number, startAngle: number, endAngle: number) {
  const startOuter = polarToCartesian(cx, cy, rOuter, endAngle);
  const endOuter = polarToCartesian(cx, cy, rOuter, startAngle);
  const startInner = polarToCartesian(cx, cy, rInner, endAngle);
  const endInner = polarToCartesian(cx, cy, rInner, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return [
    "M", startOuter.x, startOuter.y,
    "A", rOuter, rOuter, 0, largeArcFlag, 0, endOuter.x, endOuter.y,
    "L", endInner.x, endInner.y,
    "A", rInner, rInner, 0, largeArcFlag, 1, startInner.x, startInner.y,
    "Z",
  ].join(" ");
}

// Below this many occurrences, a sub-category is just something that
// happened once — not yet a pattern worth flagging as systemic.
const REPEAT_THRESHOLD = 2;

/** Shared donut chart + legend, used for both Root Cause and Incident Type
 * breakdowns on the Incident page. Clicking a category with a sub-category
 * breakdown swaps in a bar chart of that category's own sub-categories —
 * the drill-down TMSA's investigation-quality review actually wants: not
 * just "Equipment / Software" but which specific failure keeps recurring. */
export function DonutTrendCard({
  title,
  description,
  rows,
  centerSubLabel,
  overflowNoun,
}: {
  title: string;
  description: string;
  rows: DonutRow[];
  centerSubLabel: string;
  overflowNoun: string;
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  if (rows.length === 0) return null;

  const top = rows.slice(0, MAX_SLICES);
  const overflow = rows.slice(MAX_SLICES);
  const overflowCount = overflow.reduce((sum, r) => sum + r.count, 0);

  const slices: Slice[] = top.map((r, i) => ({
    ...r,
    color: SLICE_COLORS[i % SLICE_COLORS.length] ?? OTHER_COLOR,
  }));
  if (overflowCount > 0) {
    slices.push({
      key: "__other__",
      label: `Other (${overflow.length} ${overflowNoun})`,
      count: overflowCount,
      color: OTHER_COLOR,
    });
  }

  const total = slices.reduce((sum, s) => sum + s.count, 0);
  const cx = 100;
  const cy = 100;
  const rOuter = 90;
  const rInner = 52;

  let angle = 0;
  const paths = slices.map((s) => {
    const sweep = (s.count / total) * 360;
    const start = angle;
    const end = angle + sweep;
    angle = end;
    // A single 100% slice degenerates to a zero-length arc — draw a full
    // ring instead of an arc path in that case.
    const isFullCircle = sweep >= 359.99;
    return { ...s, start, end, isFullCircle };
  });

  const selected = slices.find((s) => s.key === selectedKey && s.subRows && s.subRows.length > 0);
  const maxSubCount = selected ? Math.max(...selected.subRows!.map((s) => s.count), 1) : 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
        <div className="relative shrink-0">
          <svg viewBox="0 0 200 200" className="h-48 w-48">
            {paths.map((s) =>
              s.isFullCircle ? (
                <circle
                  key={s.key}
                  cx={cx}
                  cy={cy}
                  r={(rOuter + rInner) / 2}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={rOuter - rInner}
                />
              ) : (
                <path key={s.key} d={donutSlicePath(cx, cy, rOuter, rInner, s.start, s.end)} fill={s.color} />
              ),
            )}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-semibold tabular-nums">{total}</span>
            <span className="text-xs text-muted-foreground">{centerSubLabel}</span>
          </div>
        </div>

        <ul className="w-full min-w-0 flex-1 space-y-1">
          {slices.map((s) => {
            const clickable = !!s.subRows && s.subRows.length > 0;
            const isSelected = s.key === selectedKey;
            return (
              <li key={s.key}>
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => setSelectedKey(isSelected ? null : s.key)}
                  className={`flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors ${
                    clickable ? "hover:bg-muted disabled:cursor-default" : "cursor-default"
                  } ${isSelected ? "bg-muted" : ""}`}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="min-w-0 flex-1 truncate text-sm">{s.label}</span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">{s.count}</span>
                  <span className="w-10 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                    {Math.round((s.count / total) * 100)}%
                  </span>
                  {clickable && (
                    <ChevronRight
                      className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${isSelected ? "rotate-90" : ""}`}
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </CardContent>

      {selected && (
        <CardContent className="border-t border-border pt-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold">{selected.label} — sub-category breakdown</h4>
            <button
              type="button"
              onClick={() => setSelectedKey(null)}
              aria-label="Close breakdown"
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-2.5">
            {selected.subRows!.map((sr) => (
              <div key={sr.key} className="flex items-center gap-3">
                <span className="w-40 shrink-0 truncate text-xs text-muted-foreground">{sr.label}</span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max((sr.count / maxSubCount) * 100, 4)}%`,
                      backgroundColor: selected.color,
                    }}
                  />
                </div>
                {sr.count >= REPEAT_THRESHOLD && (
                  <Badge tone="warning" className="shrink-0 gap-1">
                    <AlertCircle className="h-3 w-3" /> Repeat
                  </Badge>
                )}
                <span className="w-6 shrink-0 text-right text-sm font-semibold tabular-nums">{sr.count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
