// Lightweight, dependency-free bar charts for internal KPI dashboards.
// Single-series horizontal bars, or stacked bars for grouped breakdowns.

export type BarDatum = { label: string; value: number; color?: string };

export function BarChart({ data }: { data: BarDatum[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No data for this period.</p>;
  }
  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3 text-sm">
          <div className="w-44 shrink-0 truncate text-muted-foreground" title={d.label}>
            {d.label}
          </div>
          <div className="h-5 flex-1 overflow-hidden rounded bg-muted/40">
            <div
              className="h-5 rounded"
              style={{ width: `${(d.value / max) * 100}%`, backgroundColor: d.color ?? "hsl(var(--accent))" }}
            />
          </div>
          <div className="w-10 shrink-0 text-right tabular-nums font-medium">{d.value}</div>
        </div>
      ))}
    </div>
  );
}

export type StackedDatum = { label: string; segments: { key: string; value: number; color: string }[] };
export type LegendEntry = { key: string; color: string };

export function StackedBarChart({ data, legend }: { data: StackedDatum[]; legend: LegendEntry[] }) {
  const totals = data.map((d) => d.segments.reduce((s, x) => s + x.value, 0));
  const max = Math.max(1, ...totals);
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No data for this period.</p>;
  }
  return (
    <div className="space-y-4">
      <div className="space-y-2.5">
        {data.map((d, i) => (
          <div key={d.label} className="flex items-center gap-3 text-sm">
            <div className="w-32 shrink-0 truncate text-muted-foreground" title={d.label}>
              {d.label}
            </div>
            <div className="flex h-5 flex-1 overflow-hidden rounded bg-muted/40">
              {d.segments
                .filter((s) => s.value > 0)
                .map((s) => (
                  <div
                    key={s.key}
                    style={{ width: `${(s.value / max) * 100}%`, backgroundColor: s.color }}
                    title={`${s.key}: ${s.value}`}
                  />
                ))}
            </div>
            <div className="w-10 shrink-0 text-right tabular-nums font-medium">{totals[i]}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
        {legend.map((l) => (
          <div key={l.key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: l.color }} />
            {l.key}
          </div>
        ))}
      </div>
    </div>
  );
}

export type YearDatum = { year: number; value: number };

/** Vertical bar chart for a value-per-year series (e.g. fleet size over
 * time) — one highlighted "peak" year, a value label above each bar, and
 * the year rotated below it so a long run of years stays legible. */
export function YearBarChart({
  data,
  peakYear,
  unit = "vessels",
}: {
  data: YearDatum[];
  peakYear?: number;
  unit?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No history to chart yet.</p>;
  }
  // Fixed pixel track height for the bars, kept separate from the labels
  // above/below — percentage heights on a flex item that shares a column
  // with other siblings don't resolve consistently across browsers, which
  // let taller bars drift below the shared baseline. A plain pixel height
  // inside its own fixed-height track has no such ambiguity.
  const TRACK_HEIGHT = 160;
  return (
    <div className="flex items-end gap-1 overflow-x-auto pl-4 pb-10">
      {data.map((d) => (
        <div key={d.year} className="flex flex-1 min-w-[1.75rem] flex-col items-center">
          <div className="mb-1 text-[11px] font-semibold tabular-nums">{d.value}</div>
          <div className="flex w-full items-end" style={{ height: TRACK_HEIGHT }}>
            <div
              className="w-full rounded-t"
              style={{
                height: Math.max((d.value / max) * TRACK_HEIGHT, d.value > 0 ? 2 : 0),
                backgroundColor: d.year === peakYear ? "hsl(var(--warning))" : "hsl(var(--accent))",
              }}
              title={`${d.year}: ${d.value} ${unit}`}
            />
          </div>
          <div className="relative mt-2 h-8 w-full">
            <span
              className="absolute right-1/2 top-0 whitespace-nowrap text-[10px] text-muted-foreground"
              style={{ transform: "rotate(-45deg)", transformOrigin: "right top" }}
            >
              {d.year}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Small fixed qualitative palette — cycles for any number of series. */
export const CHART_PALETTE = [
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#ef4444", // red
  "#10b981", // emerald
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
];

export function paletteColor(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length]!;
}
