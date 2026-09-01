"use client";

import { useEffect, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceArea, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

export type FleetVar = { id: string; name: string; variancePct: number; budget: number; actual: number };

// Overspend beyond −5% = Red (non-compliant); within ±5% = Green (SMS OK);
// underspend beyond +5% = Amber (big saving, still a deviation).
const barColor = (v: number) => (v < -5 ? "#ef4444" : v > 5 ? "#f59e0b" : "#10b981");

// Recharts colours are set in JS, so the app's class-based dark mode can't reach
// them — track the `.dark` class on <html> and pick legible colours per theme.
function useDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setDark(el.classList.contains("dark"));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

export default function OpexFleetChart({ data, onSelect }: { data: FleetVar[]; onSelect?: (id: string) => void }) {
  const max = Math.max(6, ...data.map((d) => Math.abs(d.variancePct))) * 1.15;
  const dark = useDark();
  const c = dark
    ? { label: "#cbd5e1", axis: "#94a3b8", grid: "#ffffff14", axisLine: "#ffffff22", value: "#cbd5e1", tipBg: "#1e293b", tipBorder: "#33405c", tipText: "#e2e8f0", cursor: "#ffffff12" }
    : { label: "#334155", axis: "#64748b", grid: "#94a3b833", axisLine: "#94a3b855", value: "#475569", tipBg: "#ffffff", tipBorder: "#cbd5e1", tipText: "#1e293b", cursor: "#94a3b81a" };

  // Sort worst overspend (most negative) → biggest saving, so the columns read
  // left-to-right in a meaningful order.
  const rows = [...data].sort((a, b) => a.variancePct - b.variancePct);

  const idByName = new Map(rows.map((d) => [d.name, d.id]));
  const pick = (name?: string) => { const id = name ? idByName.get(name) : undefined; if (id) onSelect?.(id); };
  const [hovered, setHovered] = useState<string | null>(null);

  // Clickable, rotated vessel name on the X axis — turns blue on hover to signal
  // it's a link, and jumps to that vessel's detail below when clicked.
  const NameTick = (p: { x?: number; y?: number; payload?: { value?: string } }) => {
    const name = p.payload?.value ?? "";
    const active = onSelect && hovered === name;
    return (
      <text x={p.x} y={p.y} dy={8} textAnchor="end" fontSize={11} fill={active ? "#2f7ef5" : c.label} fontWeight={active ? 600 : 400}
        transform={`rotate(-40, ${p.x}, ${p.y})`}
        style={{ cursor: onSelect ? "pointer" : "default" }}
        onMouseEnter={() => setHovered(name)} onMouseLeave={() => setHovered(null)}
        onClick={() => pick(name)}>
        {name}
      </text>
    );
  };

  // Variance % label above (saving) or below (overspend) each column, coloured
  // by SMS band.
  const VarLabel = (p: { x?: number; y?: number; width?: number; height?: number; value?: number }) => {
    const { x, y, width, height, value } = p;
    if (x == null || y == null || width == null || height == null || value == null) return null;
    const cx = x + width / 2;
    const yPos = value >= 0 ? y - 5 : y + height + 12;
    return (
      <text x={cx} y={yPos} textAnchor="middle" fontSize={10} fontWeight={700} fill={barColor(value)}>
        {`${value > 0 ? "+" : ""}${value.toFixed(1)}%`}
      </text>
    );
  };

  return (
    <div>
      <div>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={rows} margin={{ top: 20, right: 12, left: 4, bottom: 56 }} onClick={(s) => pick(s?.activeLabel as string | undefined)} style={{ cursor: onSelect ? "pointer" : "default" }}>
            <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
            <XAxis dataKey="name" tick={NameTick as never} interval={0} height={70} axisLine={{ stroke: c.axisLine }} tickLine={false} />
            <YAxis type="number" domain={[-max, max]} tickFormatter={(v) => `${Number(v).toFixed(1)}%`} tick={{ fill: c.axis, fontSize: 11 }} axisLine={{ stroke: c.axisLine }} tickLine={false} width={48} />
            <Tooltip
              cursor={{ fill: c.cursor }}
              contentStyle={{ borderRadius: 8, border: `1px solid ${c.tipBorder}`, backgroundColor: c.tipBg, color: c.tipText, fontSize: 12 }}
              itemStyle={{ color: c.tipText }}
              labelStyle={{ color: c.tipText, fontWeight: 600 }}
              formatter={((v: number, _n: unknown, p: { payload: FleetVar }) => [
                `${v > 0 ? "+" : ""}${v.toFixed(1)}%  (Budget ${p.payload.budget.toLocaleString()} · Actual ${p.payload.actual.toLocaleString()})`,
                "Variance",
              ]) as never}
            />
            {/* ±5% SMS tolerance band + reference lines */}
            <ReferenceArea y1={-5} y2={5} fill="#10b981" fillOpacity={0.07} />
            <ReferenceLine y={0} stroke="#94a3b8" />
            <ReferenceLine y={-5} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "−5% SMS", position: "insideBottomRight", fill: "#ef4444", fontSize: 10 }} />
            <ReferenceLine y={5} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "+5%", position: "insideTopRight", fill: "#f59e0b", fontSize: 10 }} />
            <Bar dataKey="variancePct" radius={[3, 3, 0, 0]} maxBarSize={34}>
              {rows.map((d, i) => <Cell key={i} fill={barColor(d.variancePct)} />)}
              <LabelList dataKey="variancePct" content={VarLabel as never} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
