"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import OpexFleetChart, { type FleetVar } from "./OpexFleetChart";
import OpexBudgetActualChart from "./OpexBudgetActualChart";
import { opexBand, variancePct } from "./constants";

type ChartMode = "variance" | "budgetActual";

export type FleetRow = { id: string; name: string; budget: number; actual: number; uploaded: boolean; archived?: boolean };

const peso = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const pct = (n: number | null) => (n === null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(1)}%`);

// Segmented-toggle button style — the active view is a solid blue chip so it's
// obvious which chart is shown and that a switcher exists at all.
const segCls = (active: boolean) =>
  active
    ? "rounded-md bg-sky-600 px-2.5 py-1 font-semibold text-white shadow-sm"
    : "rounded-md px-2.5 py-1 font-medium text-slate-500 hover:text-sky-700";

export default function OpexFleetSection({
  rows, period, periodLabel, vesselCount, selectedDetailId,
}: {
  rows: FleetRow[];
  period: string;
  periodLabel: string;
  vesselCount: number;
  selectedDetailId: string;
}) {
  const uploadedIds = useMemo(() => rows.filter((r) => r.uploaded).map((r) => r.id), [rows]);
  // Which vessels are included in the graph / totals. Default: all uploaded.
  const [selected, setSelected] = useState<Set<string>>(() => new Set(uploadedIds));
  // Which chart the viewer is looking at.
  const [chartMode, setChartMode] = useState<ChartMode>("budgetActual");

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const chosen = rows.filter((r) => r.uploaded && selected.has(r.id));

  const chartData: FleetVar[] = chosen
    .map((v) => ({ id: v.id, name: v.name, budget: v.budget, actual: v.actual, variancePct: variancePct(v.budget, v.actual) ?? 0 }))
    .sort((a, b) => a.variancePct - b.variancePct);
  const compliant = chartData.filter((d) => Math.abs(d.variancePct) <= 5).length;

  const uploadedCount = uploadedIds.length;
  const archivedCount = rows.filter((r) => r.archived).length;
  const activeUploadedCount = uploadedCount - archivedCount;
  const linkFor = (id: string) => `/opex-controller?vessel=${id}&period=${period}`;

  // Clicking a vessel in the chart jumps to its per-category detail below.
  const router = useRouter();
  const selectVessel = (id: string) => router.push(linkFor(id), { scroll: false });

  return (
    <>
      {/* Fleet chart — viewer switches between Variance % and Budget vs Actual */}
      {chartData.length > 0 ? (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                {chartMode === "variance" ? "Fleet Variance vs SMS ±5% Tolerance" : "Budget vs Actual by Vessel"}
              </h3>
              <p className="mt-0.5 text-xs text-slate-400">
                {periodLabel} · {chartMode === "variance"
                  ? "Variance % = (Budget − Actual) ÷ Budget"
                  : "Blue = Budget · Red = Actual · % on top = Variance"}
              </p>
            </div>
            {/* Chart switcher — makes it obvious there are two views */}
            <div className="inline-flex shrink-0 rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
              <button type="button" onClick={() => setChartMode("variance")} className={segCls(chartMode === "variance")}>Variance %</button>
              <button type="button" onClick={() => setChartMode("budgetActual")} className={segCls(chartMode === "budgetActual")}>Budget vs Actual</button>
            </div>
          </div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            {chartMode === "variance" ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-red-500" /> Over budget (beyond −5%)</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-emerald-500" /> Within ±5% (SMS OK)</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-amber-500" /> Under budget (beyond +5%)</span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ backgroundColor: "#3b6fd4" }} /> Budget</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ backgroundColor: "#d1495b" }} /> Actual</span>
                <span className="inline-flex items-center gap-1.5"><span className="font-semibold text-slate-400">%</span> Variance (on top of bars)</span>
              </div>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-xs ring-1 ring-slate-200">
              <span className={`h-1.5 w-1.5 rounded-full ${compliant === chartData.length ? "bg-emerald-500" : "bg-amber-500"}`} />
              <span className={`font-semibold ${compliant === chartData.length ? "text-emerald-600" : "text-amber-600"}`}>{compliant}/{chartData.length}</span>
              <span className="text-slate-500">within ±5%</span>
            </span>
          </div>
          {chartMode === "variance"
            ? <OpexFleetChart data={chartData} onSelect={selectVessel} />
            : <OpexBudgetActualChart data={chartData} onSelect={selectVessel} />}
          <p className="mt-2 text-[11px] text-slate-400">Tip: click a vessel in the chart to open its detailed breakdown below.</p>
        </div>
      ) : (
        <div className="mb-6 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-400 shadow-sm">
          No vessels selected — tick vessels in the Fleet Summary below to graph them.
        </div>
      )}

      {/* Fleet summary table — collapsible; tick which vessels to graph */}
      <details data-persist className="group mb-6 rounded-xl border border-slate-200 bg-white shadow-sm">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <ChevronRight className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-90" />
            Fleet Summary · {periodLabel}
          </span>
          <span className="text-xs text-slate-500">
            Graphing{" "}
            <span className="font-semibold text-sky-600">{chosen.length}/{uploadedCount}</span> uploaded
            {activeUploadedCount < vesselCount && <span className="text-slate-400"> · {vesselCount - activeUploadedCount} pending upload</span>}
            {archivedCount > 0 && <span className="text-slate-400"> · {archivedCount} archived</span>}
          </span>
        </summary>
        <div className="overflow-auto border-t border-slate-200">
          <table className="w-full text-left text-sm tabular-nums">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-3 py-2.5 font-semibold">Vessel</th>
                <th className="px-3 py-2.5 text-right font-semibold">Total Budget</th>
                <th className="px-3 py-2.5 text-right font-semibold">Total Expenses</th>
                <th className="px-3 py-2.5 text-right font-semibold">Variance</th>
                <th className="px-3 py-2.5 text-right font-semibold">Variance %</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((v) => {
                if (!v.uploaded) {
                  return (
                    <tr key={v.id} className="text-slate-400 hover:bg-slate-50/60">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="inline-block h-4 w-4 shrink-0" />
                          <span className="font-medium text-slate-500">{v.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">—</td>
                      <td className="px-3 py-3 text-right">—</td>
                      <td className="px-3 py-3 text-right">—</td>
                      <td className="px-3 py-3 text-right">—</td>
                      <td className="px-3 py-3"><span className="whitespace-nowrap rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">Not uploaded</span></td>
                    </tr>
                  );
                }
                const band = opexBand(v.budget, v.actual);
                const vp = variancePct(v.budget, v.actual);
                const on = selected.has(v.id);
                return (
                  <tr key={v.id} className={`hover:bg-slate-50/60 ${v.id === selectedDetailId ? "bg-sky-50/40" : ""} ${on ? "" : "opacity-50"}`}>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggle(v.id)}
                          aria-label={`Graph ${v.name}`}
                          className="h-4 w-4 shrink-0 cursor-pointer accent-sky-600"
                        />
                        <Link href={linkFor(v.id)} className="font-medium text-sky-700 hover:underline">{v.name}</Link>
                        {v.archived && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Archived</span>}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right text-slate-600">{peso(v.budget)}</td>
                    <td className="px-3 py-3 text-right text-slate-600">{peso(v.actual)}</td>
                    <td className={`px-3 py-3 text-right font-medium ${v.budget - v.actual < 0 ? "text-red-600" : "text-emerald-700"}`}>{peso(v.budget - v.actual)}</td>
                    <td className={`px-3 py-3 text-right font-medium ${(vp ?? 0) < 0 ? "text-red-600" : "text-emerald-700"}`}>{pct(vp)}</td>
                    <td className="px-3 py-3"><span className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold ${band.cls}`}>{band.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
