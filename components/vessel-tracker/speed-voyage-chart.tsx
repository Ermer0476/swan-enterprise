// Avg speed per voyage — same dependency-free SVG house style as
// components/ui/trend-chart.tsx, but trend-chart is single-color-line only
// and this needs a second dimension per point (laden/ballast) plus a third
// (Beaufort scale) in the tooltip, so it's its own small component rather
// than a variant bolted onto trend-chart.

export type VoyageSpeedPoint = {
  voyageNo: string;
  avgSpeedKn: number | null;
  avgBeaufort: number | null;
  ladenState: "LADEN" | "BALLAST";
};

const LADEN_COLOR = "#dc2626"; // matches components/vessel-tracker/status-icons.tsx's LADEN badge
const BALLAST_COLOR = "#94a3b8"; // matches its BALLAST badge

export function SpeedPerVoyageChart({ points, height = 220 }: { points: VoyageSpeedPoint[]; height?: number }) {
  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">No voyages with a recorded speed yet.</p>;
  }

  const width = Math.max(360, points.length * 56);
  const padding = { top: 28, right: 16, bottom: 48, left: 40 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const speeds = points.map((p) => p.avgSpeedKn).filter((v): v is number => v !== null);
  const rawMax = Math.max(...speeds, 1);
  const niceMax = Math.ceil((rawMax * 1.15) / 2) * 2;

  const xStep = points.length > 1 ? innerW / (points.length - 1) : 0;
  const xFor = (i: number) => padding.left + i * xStep;
  const yFor = (v: number) => padding.top + innerH - (v / niceMax) * innerH;

  const segments: string[] = [];
  let current: string[] = [];
  points.forEach((p, i) => {
    if (p.avgSpeedKn === null) {
      if (current.length) segments.push(current.join(" "));
      current = [];
      return;
    }
    current.push(`${current.length ? "L" : "M"}${xFor(i)},${yFor(p.avgSpeedKn)}`);
  });
  if (current.length) segments.push(current.join(" "));

  const GRID_LINES = 4;
  const gridStep = niceMax / GRID_LINES;

  return (
    <div>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" className="block">
        {Array.from({ length: GRID_LINES + 1 }).map((_, i) => {
          const v = gridStep * i;
          const y = yFor(v);
          return (
            <g key={i}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="hsl(var(--border))" strokeWidth={1} />
              <text x={padding.left - 8} y={y} textAnchor="end" dominantBaseline="middle" fontSize={10} style={{ fill: "hsl(var(--muted-foreground))" }}>
                {v.toFixed(0)}
              </text>
            </g>
          );
        })}

        {points.map((p, i) => (
          <g key={`${p.voyageNo}-label`}>
            <text x={xFor(i)} y={height - padding.bottom + 16} textAnchor="middle" fontSize={10} style={{ fill: "hsl(var(--muted-foreground))" }}>
              {p.voyageNo.length > 8 ? `${p.voyageNo.slice(0, 8)}…` : p.voyageNo}
            </text>
            {/* State printed directly under each voyage, not just implied by
                dot color — reading it shouldn't require cross-checking the
                legend or hovering the tooltip. */}
            <text
              x={xFor(i)}
              y={height - padding.bottom + 28}
              textAnchor="middle"
              fontSize={9}
              fontWeight={600}
              style={{ fill: p.ladenState === "LADEN" ? LADEN_COLOR : BALLAST_COLOR }}
            >
              {p.ladenState === "LADEN" ? "Laden" : "Ballast"}
            </text>
          </g>
        ))}

        {segments.map((d, idx) => (
          <path key={idx} d={d} fill="none" stroke="hsl(var(--accent))" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        ))}

        {points.map((p, i) => {
          if (p.avgSpeedKn === null) return null;
          const color = p.ladenState === "LADEN" ? LADEN_COLOR : BALLAST_COLOR;
          const title = `Voyage ${p.voyageNo} — ${p.avgSpeedKn.toFixed(2)} kn, ${p.ladenState === "LADEN" ? "Laden" : "Ballast"}${
            p.avgBeaufort !== null ? `, Beaufort ${p.avgBeaufort.toFixed(1)}` : ""
          }`;
          return (
            <g key={p.voyageNo}>
              <circle cx={xFor(i)} cy={yFor(p.avgSpeedKn)} r={4} fill={color} stroke="white" strokeWidth={1.5}>
                <title>{title}</title>
              </circle>
              <text x={xFor(i)} y={yFor(p.avgSpeedKn) - 10} textAnchor="middle" fontSize={10} fontWeight={600} style={{ fill: "hsl(var(--foreground))" }}>
                {p.avgSpeedKn.toFixed(1)}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: LADEN_COLOR }} /> Laden
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: BALLAST_COLOR }} /> Ballast
        </div>
        <span>Hover a point for Beaufort scale.</span>
      </div>
    </div>
  );
}
