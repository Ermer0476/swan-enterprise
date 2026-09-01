// Lightweight, dependency-free donut chart — SVG stroke-dasharray segments
// around a ring, with a centered total and a count(+percentage) legend
// below. Optionally interactive: pass onSliceClick to make both the ring
// segments and the legend rows clickable (e.g. category drill-down), and
// selectedLabel to dim everything except the active slice.

export type DonutDatum = { label: string; value: number; color: string };

export function DonutChart({
  title,
  data,
  size = 140,
  thickness = 20,
  sliceLabels = false,
  legendShowPercent = true,
  selectedLabel,
  onSliceClick,
}: {
  title: string;
  data: DonutDatum[];
  size?: number;
  thickness?: number;
  /** Render each slice's percentage directly on the ring (only for slices
   * wide enough to fit the text legibly). */
  sliceLabels?: boolean;
  legendShowPercent?: boolean;
  selectedLabel?: string | null;
  onSliceClick?: (label: string) => void;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const radius = size / 2 - thickness / 2;
  const circumference = 2 * Math.PI * radius;
  const hasSelection = selectedLabel != null;
  const interactive = Boolean(onSliceClick);

  let cumulative = 0;
  const segments = data.map((d) => {
    const fraction = total > 0 ? d.value / total : 0;
    const dash = fraction * circumference;
    const offset = circumference * 0.25 - cumulative; // start at 12 o'clock, go clockwise
    const midCumulative = cumulative + dash / 2;
    const midFraction = circumference > 0 ? midCumulative / circumference : 0;
    const angleRad = (midFraction * 360 - 90) * (Math.PI / 180);
    const labelRadius = size / 2 - thickness / 2;
    cumulative += dash;
    return {
      ...d,
      fraction,
      dash,
      offset,
      lx: size / 2 + labelRadius * Math.cos(angleRad),
      ly: size / 2 + labelRadius * Math.sin(angleRad),
    };
  });

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-center">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={thickness}
          />
          {segments
            .filter((s) => s.value > 0)
            .map((s) => (
              <circle
                key={s.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeDasharray={`${s.dash} ${circumference - s.dash}`}
                strokeDashoffset={s.offset}
                strokeLinecap="butt"
                opacity={hasSelection && selectedLabel !== s.label ? 0.3 : 1}
                onClick={onSliceClick ? () => onSliceClick(s.label) : undefined}
                className={interactive ? "cursor-pointer transition-opacity" : undefined}
              >
                <title>{`${s.label}: ${s.value} (${Math.round(s.fraction * 100)}%)`}</title>
              </circle>
            ))}
          {sliceLabels &&
            segments
              .filter((s) => s.fraction >= 0.06)
              .map((s) => (
                <text
                  key={`${s.label}-label`}
                  x={s.lx}
                  y={s.ly}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="pointer-events-none select-none font-bold fill-white"
                  style={{ fontSize: Math.max(11, thickness * 0.42) }}
                >
                  {Math.round(s.fraction * 100)}%
                </text>
              ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <div className="font-semibold tabular-nums" style={{ fontSize: Math.round(size * 0.16) }}>
            {total}
          </div>
          <div
            className="max-w-[75%] leading-tight text-muted-foreground"
            style={{ fontSize: Math.max(10, Math.round(size * 0.05)) }}
          >
            {title}
          </div>
        </div>
      </div>
      <ul className="w-full space-y-1.5 text-xs sm:w-auto sm:min-w-52 sm:flex-1">
        {data.map((d) => (
          <li
            key={d.label}
            onClick={onSliceClick ? () => onSliceClick(d.label) : undefined}
            className={`flex items-start justify-between gap-2 rounded px-1 py-0.5 ${
              interactive ? "cursor-pointer hover:bg-muted/50" : ""
            } ${hasSelection && selectedLabel === d.label ? "bg-muted/60" : ""}`}
          >
            <span className="flex min-w-0 items-start gap-1.5 text-muted-foreground">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: d.color }} />
              <span>{d.label}</span>
            </span>
            <span className="shrink-0 whitespace-nowrap font-medium tabular-nums">
              {legendShowPercent
                ? `${d.value} (${total > 0 ? Math.round((d.value / total) * 100) : 0}%)`
                : d.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
