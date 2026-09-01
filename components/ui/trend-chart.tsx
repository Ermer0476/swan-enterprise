// Single-series area/line trend chart with an optional dashed target line
// and a value label above each point — dependency-free SVG, same house
// style as bar-chart.tsx / donut-chart.tsx / gauge-chart.tsx.

export type TrendPoint = { label: string; value: number | null; sublabel?: string };

function niceStep(rawMax: number, steps: number): number {
  if (rawMax <= 0) return 1;
  const rawStep = rawMax / steps;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return niceNormalized * magnitude;
}

export function TrendChart({
  points,
  color,
  target,
  targetLabel,
  seriesLabel,
  valueFormatter = (v: number) => v.toFixed(2),
  height = 240,
  flagOverTarget = false,
  flagColor = "#ef4444",
}: {
  points: TrendPoint[];
  color: string;
  target?: number;
  targetLabel?: string;
  seriesLabel: string;
  valueFormatter?: (v: number) => string;
  height?: number;
  /** When true, points exceeding `target` render in `flagColor` instead of
   * `color` — for series with a hard standard/ceiling (e.g. daily fuel
   * consumption) rather than a soft aspirational goal. */
  flagOverTarget?: boolean;
  flagColor?: string;
}) {
  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">No data to chart yet.</p>;
  }

  const hasSublabels = points.some((p) => p.sublabel);
  const width = Math.max(360, points.length * 40);
  const padding = { top: 28, right: 16, bottom: hasSublabels ? 40 : 28, left: 44 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const values = points.map((p) => p.value).filter((v): v is number => v !== null);
  const rawMax = Math.max(...values, target ?? 0, 0);
  const GRID_LINES = 5;
  const step = niceStep(rawMax * 1.15 || 1, GRID_LINES);
  const niceMax = step * GRID_LINES;

  const xStep = points.length > 1 ? innerW / (points.length - 1) : 0;
  const xFor = (i: number) => padding.left + i * xStep;
  const yFor = (v: number) => padding.top + innerH - (v / niceMax) * innerH;

  const segments: string[] = [];
  let current: string[] = [];
  points.forEach((p, i) => {
    if (p.value === null) {
      if (current.length) segments.push(current.join(" "));
      current = [];
      return;
    }
    current.push(`${current.length ? "L" : "M"}${xFor(i)},${yFor(p.value)}`);
  });
  if (current.length) segments.push(current.join(" "));

  // Area fill: one filled region per contiguous run of non-null points.
  const areas = segments.map((seg) => {
    const coords = seg.match(/-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?/g) ?? [];
    if (coords.length === 0) return "";
    const first = coords[0]!.split(",")[0];
    const last = coords[coords.length - 1]!.split(",")[0];
    const baseline = padding.top + innerH;
    return `${seg} L${last},${baseline} L${first},${baseline} Z`;
  });

  return (
    // A dense point count (e.g. daily granularity across a Yearly period)
    // widens the chart well past most cards — scroll horizontally rather
    // than letting preserveAspectRatio squash it into an unreadable band.
    <div className="overflow-x-auto">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" className="block">
        {Array.from({ length: GRID_LINES + 1 }).map((_, i) => {
          const v = step * i;
          const y = yFor(v);
          return (
            <g key={i}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                stroke="hsl(var(--border))"
                strokeWidth={1}
              />
              <text
                x={padding.left - 8}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={10}
                style={{ fill: "hsl(var(--muted-foreground))" }}
              >
                {v.toFixed(v < 10 ? 2 : 0)}
              </text>
            </g>
          );
        })}

        {target !== undefined && target <= niceMax && (
          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={yFor(target)}
            y2={yFor(target)}
            stroke="hsl(var(--muted-foreground))"
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
        )}

        {points.map((p, i) => (
          <g key={`${p.label}-${i}`}>
            <text x={xFor(i)} y={height - padding.bottom + 16} textAnchor="middle" fontSize={10} style={{ fill: "hsl(var(--muted-foreground))" }}>
              {p.label}
            </text>
            {/* Second, lighter row underneath — e.g. the month — so the
                per-point label (date, report type) stays short and doesn't
                collide with its neighbors when points sit close together. */}
            {p.sublabel && (
              <text x={xFor(i)} y={height - padding.bottom + 28} textAnchor="middle" fontSize={9} style={{ fill: "hsl(var(--muted-foreground))", opacity: 0.7 }}>
                {p.sublabel}
              </text>
            )}
          </g>
        ))}

        {areas.map((d, idx) => (
          <path key={idx} d={d} fill={color} fillOpacity={0.12} stroke="none" />
        ))}
        {segments.map((d, idx) => (
          <path key={idx} d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {points.map((p, i) => {
          if (p.value === null) return null;
          const isFlagged = flagOverTarget && target !== undefined && p.value > target;
          const dotColor = isFlagged ? flagColor : color;
          return (
            <g key={p.label}>
              <circle cx={xFor(i)} cy={yFor(p.value)} r={isFlagged ? 4 : 3} fill={dotColor}>
                <title>
                  {`${seriesLabel} — ${p.label}: ${valueFormatter(p.value)}`}
                  {isFlagged ? ` (exceeds standard of ${valueFormatter(target!)})` : ""}
                </title>
              </circle>
              <text
                x={xFor(i)}
                y={yFor(p.value) - 8}
                textAnchor="middle"
                fontSize={10}
                fontWeight={600}
                style={{ fill: isFlagged ? flagColor : "hsl(var(--foreground))" }}
              >
                {valueFormatter(p.value)}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
          {seriesLabel}
        </div>
        {target !== undefined && (
          <div className="flex items-center gap-1.5">
            <span className="h-0 w-3 border-t-[1.5px] border-dashed border-muted-foreground" />
            {targetLabel ?? `Target (≤ ${valueFormatter(target)})`}
          </div>
        )}
      </div>
    </div>
  );
}
