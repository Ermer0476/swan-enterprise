"use client";

import { useEffect, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, LabelList,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { FleetVar } from "./OpexFleetChart";

// Recharts colours live in JS, out of reach of the class-based dark mode — track
// the `.dark` class on <html> and choose legible colours per theme.
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

const money = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const varColor = (v: number) => (v < -5 ? "#ef4444" : v > 5 ? "#f59e0b" : "#10b981");

// Variance % label sitting on top of each vessel's bar pair, coloured by SMS
// band. Attached to the Actual bar; shifted left by half a bar so it centres
// over the touching Budget+Actual pair.
function VarLabel({ x, y, value }: { x?: number; y?: number; value?: number }) {
  if (x == null || y == null || value == null) return null;
  // x is the Actual bar's left edge = the seam it shares with the touching
  // Budget bar, i.e. the centre of the pair.
  return (
    <text x={x} y={y - 6} textAnchor="middle" fontSize={10} fontWeight={700} fill={varColor(value)}>
      {`${value > 0 ? "+" : ""}${value.toFixed(1)}%`}
    </text>
  );
}

export default function OpexBudgetActualChart({ data, onSelect }: { data: FleetVar[]; onSelect?: (id: string) => void }) {
  const dark = useDark();
  const c = dark
    ? { grid: "#ffffff14", axis: "#94a3b8", label: "#cbd5e1", axisLine: "#ffffff22", line: "#94a3b8", zero: "#ffffff33", tipBg: "#1e293b", tipBorder: "#33405c", tipText: "#e2e8f0" }
    : { grid: "#94a3b833", axis: "#64748b", label: "#334155", axisLine: "#94a3b855", line: "#64748b", zero: "#334155", tipBg: "#ffffff", tipBorder: "#cbd5e1", tipText: "#1e293b" };

  // Sort by vessel name so the paired bars read left-to-right consistently.
  const rows = [...data].sort((a, b) => a.name.localeCompare(b.name));

  const idByName = new Map(rows.map((d) => [d.name, d.id]));
  const pick = (name?: string) => { const id = name ? idByName.get(name) : undefined; if (id) onSelect?.(id); };
  const [hovered, setHovered] = useState<string | null>(null);

  // Clickable, rotated vessel name on the X axis — turns blue on hover to signal
  // it's a link, and jumps to its detail below when clicked.
  const NameTick = (p: { x?: number; y?: number; payload?: { value?: string } }) => {
    const name = p.payload?.value ?? "";
    const active = onSelect && hovered === name;
    return (
      <text x={p.x} y={p.y} dy={8} textAnchor="end" fontSize={11} fill={active ? "#2f7ef5" : c.label} fontWeight={active ? 600 : 400}
        transform={`rotate(-35, ${p.x}, ${p.y})`}
        style={{ cursor: onSelect ? "pointer" : "default" }}
        onMouseEnter={() => setHovered(name)} onMouseLeave={() => setHovered(null)}
        onClick={() => pick(name)}>
        {name}
      </text>
    );
  };

  return (
    <div>
      <div>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={rows} margin={{ top: 26, right: 12, left: 4, bottom: 44 }} barGap={0} barCategoryGap="14%" onClick={(s) => pick(s?.activeLabel as string | undefined)} style={{ cursor: onSelect ? "pointer" : "default" }}>
            <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
            <XAxis dataKey="name" tick={NameTick as never} interval={0} height={64} axisLine={{ stroke: c.axisLine }} tickLine={false} />
            <YAxis tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`} tick={{ fill: c.axis, fontSize: 11 }} axisLine={{ stroke: c.axisLine }} tickLine={false} width={44} />
            <Tooltip
              cursor={{ fill: dark ? "#ffffff10" : "#94a3b81a" }}
              contentStyle={{ borderRadius: 8, border: `1px solid ${c.tipBorder}`, backgroundColor: c.tipBg, color: c.tipText, fontSize: 12 }}
              itemStyle={{ color: c.tipText }}
              labelStyle={{ color: c.tipText, fontWeight: 600 }}
              formatter={((v: number, name: string) => [money(v), name]) as never}
            />
            <Bar dataKey="budget" name="Budget" fill="#3b6fd4" radius={[3, 3, 0, 0]} />
            <Bar dataKey="actual" name="Actual" fill="#d1495b" radius={[3, 3, 0, 0]}>
              <LabelList dataKey="variancePct" position="top" content={VarLabel as never} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
