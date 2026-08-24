// Lightweight, dependency-free bar charts for internal KPI dashboards.
// Single-series horizontal bars, or stacked bars for grouped breakdowns.

import { Circle, Lightbulb, type LucideIcon } from "lucide-react";

export type BarDatum = { label: string; value: number; color?: string; icon?: LucideIcon };

/** Single-series horizontal breakdown — an icon badge (domain-specific when
 * the caller supplies one via BarDatum.icon, a plain dot otherwise), a
 * rounded progress bar, and the count + share of total per row. Below the
 * list, a one-line auto-generated insight names the leading category so the
 * "what should I act on" read doesn't require eyeballing the bars. `unit`
 * names what's being counted (e.g. "observations", "incidents") so that
 * insight line reads naturally across different call sites. */
export function BarChart({
  data,
  unit = "entries",
  showInsight = true,
}: {
  data: BarDatum[];
  unit?: string;
  showInsight?: boolean;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No data for this period.</p>;
  }
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const top = data.reduce((a, b) => (b.value > a.value ? b : a), data[0]!);
  const topShare = total > 0 ? Math.round((top.value / total) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        {data.map((d) => {
          const Icon = d.icon ?? Circle;
          const color = d.color ?? "hsl(var(--accent))";
          const share = total > 0 ? Math.round((d.value / total) * 100) : 0;
          return (
            <div key={d.label} className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)` }}
              >
                <Icon className="h-4 w-4" style={{ color }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 truncate text-sm font-medium" title={d.label}>
                  {d.label}
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted/40">
                  <div
                    className="h-2 rounded-full"
                    style={{ width: `${(d.value / max) * 100}%`, backgroundColor: color }}
                  />
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-base font-semibold leading-none tabular-nums">{d.value}</div>
                <div className="mt-1 text-xs font-medium leading-none tabular-nums" style={{ color }}>
                  {share}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {showInsight && total > 0 && (
        <div className="flex items-start gap-2 rounded-md bg-accent/10 p-3 text-sm">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <span>
            {topShare >= 50 ? (
              <>
                More than half of all {unit} trace back to <span className="font-medium">{top.label}</span> — the
                priority area to address.
              </>
            ) : (
              <>
                <span className="font-medium">{top.label}</span> is the leading contributor, accounting for{" "}
                {topShare}% of all {unit}.
              </>
            )}
          </span>
        </div>
      )}
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
  // Bars scale into a shorter band than the track itself, leaving headroom
  // at the top so the value label above the tallest (peak) bar has room to
  // render instead of butting against — or clipping past — the track edge.
  const LABEL_SPACE = 22;
  const BAR_MAX = TRACK_HEIGHT - LABEL_SPACE;
  return (
    <div className="flex items-end gap-1 overflow-x-auto pl-4 pb-10">
      {data.map((d) => {
        const barHeight = Math.max((d.value / max) * BAR_MAX, d.value > 0 ? 2 : 0);
        return (
        <div key={d.year} className="flex flex-1 min-w-[1.75rem] flex-col items-center">
          <div className="relative flex w-full items-end" style={{ height: TRACK_HEIGHT }}>
            <span
              className="absolute inset-x-0 text-center text-[11px] font-semibold tabular-nums"
              style={{ bottom: barHeight + 4 }}
            >
              {d.value}
            </span>
            <div
              className="w-full rounded-t"
              style={{
                height: barHeight,
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
        );
      })}
    </div>
  );
}

/** Vertical bar chart for a small fixed category axis (e.g. VIQ chapters
 * 1-12) — a value label above each bar, category label rotated below it so
 * every category stays legible even at 0. Caller is responsible for
 * including zero-value entries (this component doesn't fill gaps itself,
 * since "which categories exist" is domain knowledge it shouldn't own). */
export function VerticalBarChart({ data }: { data: BarDatum[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No data for this period.</p>;
  }
  const TRACK_HEIGHT = 160;
  const LABEL_SPACE = 22;
  const BAR_MAX = TRACK_HEIGHT - LABEL_SPACE;
  return (
    <div className="flex items-end gap-1 overflow-x-auto pl-4 pb-14">
      {data.map((d) => {
        const barHeight = Math.max((d.value / max) * BAR_MAX, d.value > 0 ? 2 : 0);
        return (
          <div key={d.label} className="flex flex-1 min-w-[2.25rem] flex-col items-center">
            <div className="relative flex w-full items-end" style={{ height: TRACK_HEIGHT }}>
              <span
                className="absolute inset-x-0 text-center text-[11px] font-semibold tabular-nums"
                style={{ bottom: barHeight + 4 }}
              >
                {d.value}
              </span>
              <div
                className="w-full rounded-t"
                style={{ height: barHeight, backgroundColor: d.color ?? "hsl(var(--accent))" }}
                title={`${d.label}: ${d.value}`}
              />
            </div>
            <div className="relative mt-2 h-10 w-full">
              <span
                className="absolute right-1/2 top-0 max-w-[6rem] whitespace-nowrap text-[10px] text-muted-foreground"
                style={{ transform: "rotate(-45deg)", transformOrigin: "right top" }}
              >
                {d.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Grouped vertical bar chart — one cluster per category (e.g. month), each
 * cluster made of side-by-side bars (not stacked) for each series, so every
 * series stays independently readable at a glance instead of needing to be
 * mentally subtracted out of a stack. All bars share one scale (the largest
 * single bar's value across the whole chart), so heights compare directly
 * both within a cluster and across clusters. */
export function VerticalGroupedBarChart({ data, legend }: { data: StackedDatum[]; legend: LegendEntry[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No data for this period.</p>;
  }
  const max = Math.max(1, ...data.flatMap((d) => d.segments.map((s) => s.value)));
  const TRACK_HEIGHT = 160;
  const LABEL_SPACE = 22;
  const BAR_MAX = TRACK_HEIGHT - LABEL_SPACE;
  return (
    <div className="space-y-4">
      <div className="flex items-end gap-6 overflow-x-auto pl-4 pb-14">
        {data.map((d) => (
          <div key={d.label} className="flex flex-1 min-w-[9rem] flex-col items-center">
            <div className="flex w-full items-end justify-center gap-2" style={{ height: TRACK_HEIGHT }}>
              {d.segments.map((s) => {
                const barHeight = Math.max((s.value / max) * BAR_MAX, s.value > 0 ? 2 : 0);
                return (
                  <div key={s.key} className="relative flex h-full w-10 shrink-0 items-end justify-center">
                    <span
                      className="absolute inset-x-0 whitespace-nowrap text-center text-[10px] font-semibold tabular-nums"
                      style={{ bottom: barHeight + 4 }}
                    >
                      {s.value}
                    </span>
                    <div className="w-full rounded-t" style={{ height: barHeight, backgroundColor: s.color }} title={`${s.key}: ${s.value}`} />
                  </div>
                );
              })}
            </div>
            <div className="relative mt-2 h-10 w-full">
              <span
                className="absolute right-1/2 top-0 max-w-[6rem] whitespace-nowrap text-[10px] text-muted-foreground"
                style={{ transform: "rotate(-45deg)", transformOrigin: "right top" }}
              >
                {d.label}
              </span>
            </div>
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
