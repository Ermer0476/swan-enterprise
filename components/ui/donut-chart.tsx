// Lightweight, dependency-free donut chart — SVG stroke-dasharray segments
// around a ring, with a centered total and a count+percentage legend below.

export type DonutDatum = { label: string; value: number; color: string };

export function DonutChart({
  title,
  data,
  size = 140,
  thickness = 20,
}: {
  title: string;
  data: DonutDatum[];
  size?: number;
  thickness?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const radius = size / 2 - thickness / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulative = 0;
  const segments = data.map((d) => {
    const fraction = total > 0 ? d.value / total : 0;
    const dash = fraction * circumference;
    const offset = circumference * 0.25 - cumulative; // start at 12 o'clock, go clockwise
    cumulative += dash;
    return { ...d, fraction, dash, offset };
  });

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
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
              >
                <title>{`${s.label}: ${s.value} (${Math.round(s.fraction * 100)}%)`}</title>
              </circle>
            ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <div className="text-xl font-semibold tabular-nums">{total}</div>
          <div className="max-w-[80%] text-[10px] leading-tight text-muted-foreground">{title}</div>
        </div>
      </div>
      <ul className="mt-3 w-full space-y-1.5 text-xs">
        {data.map((d) => (
          <li key={d.label} className="flex items-start justify-between gap-2">
            <span className="flex min-w-0 items-start gap-1.5 text-muted-foreground">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: d.color }} />
              <span>{d.label}</span>
            </span>
            <span className="shrink-0 whitespace-nowrap font-medium tabular-nums">
              {d.value} ({total > 0 ? Math.round((d.value / total) * 100) : 0}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
