// Semi-circle "KPI vs target" gauge — dependency-free SVG, same house style
// as bar-chart.tsx / donut-chart.tsx / trend-chart.tsx. Green band up to
// target, amber up to 1.5x target, red beyond — a fixed, simple convention
// rather than a configurable scale, since every gauge on this dashboard
// reads the same way.

function polarPoint(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// Value 0..max maps to angle 180deg (left) .. 360deg (right), sweeping
// across the top of the circle.
function angleFor(value: number, max: number): number {
  const clamped = Math.max(0, Math.min(value, max));
  return 180 + (clamped / max) * 180;
}

function arcPath(cx: number, cy: number, r: number, fromAngle: number, toAngle: number): string {
  const start = polarPoint(cx, cy, r, fromAngle);
  const end = polarPoint(cx, cy, r, toAngle);
  return `M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`;
}

export function GaugeChart({
  value,
  target,
  label,
  valueFormatter = (v: number) => v.toFixed(2),
  size = 220,
}: {
  value: number;
  target: number;
  label: string;
  valueFormatter?: (v: number) => string;
  size?: number;
}) {
  const max = target * 2;
  const cx = size / 2;
  const cy = size / 2 + 6;
  const r = size / 2 - 28;
  const thickness = 16;

  const bands = [
    { from: 0, to: target, color: "hsl(var(--success))" },
    { from: target, to: target * 1.5, color: "hsl(var(--warning))" },
    { from: target * 1.5, to: max, color: "hsl(var(--danger))" },
  ];

  const needleAngle = angleFor(value, max);
  const needleTip = polarPoint(cx, cy, r - thickness / 2 - 4, needleAngle);
  const height = cy + 24;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={height} viewBox={`0 0 ${size} ${height}`}>
        {bands.map((b) => (
          <path
            key={b.from}
            d={arcPath(cx, cy, r, angleFor(b.from, max), angleFor(b.to, max))}
            fill="none"
            stroke={b.color}
            strokeWidth={thickness}
            strokeLinecap="butt"
          />
        ))}

        {[0, target, max].map((tick) => {
          const p = polarPoint(cx, cy, r + thickness / 2 + 8, angleFor(tick, max));
          // The 0/max labels sit at the same height as the arc's flat ends,
          // so centering them there ran the text under the colored band —
          // drop them below the arc instead, where there's clear space.
          const isEnd = tick === 0 || tick === max;
          return (
            <text
              key={tick}
              x={p.x}
              y={isEnd ? p.y + 14 : p.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={10}
              style={{ fill: "hsl(var(--muted-foreground))" }}
            >
              {valueFormatter(tick)}
            </text>
          );
        })}

        <line x1={cx} y1={cy} x2={needleTip.x} y2={needleTip.y} stroke="hsl(var(--foreground))" strokeWidth={2.5} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={5} fill="hsl(var(--foreground))" />
      </svg>
      <div className="-mt-2 text-2xl font-semibold tabular-nums">{valueFormatter(value)}</div>
      <div className="text-center text-xs text-muted-foreground" style={{ maxWidth: size }}>
        {label}
      </div>
    </div>
  );
}
