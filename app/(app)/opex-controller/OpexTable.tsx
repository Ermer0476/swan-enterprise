"use client";

import { Fragment, useState, useTransition } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { saveOpexRow } from "./actions";
import { opexBand, variancePct } from "./constants";

export type OpexSub = { name: string; budget: number; actual: number };
export type OpexNode = { category: string; budget: number; actual: number; subs: OpexSub[]; note: string | null };

const peso = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const pct = (n: number | null) => (n === null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(1)}%`);
const varCls = (b: number, a: number) => ((variancePct(b, a) ?? 0) < 0 ? "text-red-600" : "text-emerald-700");

function CategoryRow({ node, vesselId, monthYear }: { node: OpexNode; vesselId: string; monthYear: string }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [budget, setBudget] = useState(String(node.budget || ""));
  const [actual, setActual] = useState(String(node.actual || ""));
  const [note, setNote] = useState(node.note ?? "");
  const [pending, start] = useTransition();

  const hasSubs = node.subs.length > 0;
  const b = Number(budget) || 0;
  const a = Number(actual) || 0;
  const util = node.budget > 0 ? Math.round((node.actual / node.budget) * 100) : node.actual > 0 ? 999 : 0;
  const band = opexBand(node.budget, node.actual);

  const save = () =>
    start(async () => {
      await saveOpexRow({ vesselId, monthYear, category: node.category, budgetAllocated: b, actualCost: a, note });
      setEditing(false);
    });

  if (editing) {
    return (
      <Fragment>
        <tr className="bg-sky-50/40 border-b-0">
          <td className="px-3 py-2.5 font-medium text-slate-700">{node.category}</td>
          <td className="px-3 py-2.5 text-right"><input value={budget} onChange={(e) => setBudget(e.target.value)} inputMode="decimal" className="w-28 rounded border border-slate-300 px-2 py-1 text-right text-sm focus:border-sky-500 focus:outline-none" /></td>
          <td className="px-3 py-2.5 text-right"><input value={actual} onChange={(e) => setActual(e.target.value)} inputMode="decimal" className="w-28 rounded border border-slate-300 px-2 py-1 text-right text-sm focus:border-sky-500 focus:outline-none" /></td>
          <td className={`px-3 py-2.5 text-right font-medium ${b - a < 0 ? "text-red-600" : "text-slate-600"}`}>{peso(b - a)}</td>
          <td className="px-3 py-2.5 text-right text-slate-400">—</td>
          <td className="px-3 py-2.5 text-center text-slate-400">—</td>
          <td className="px-3 py-2.5"></td>
          <td className="whitespace-nowrap px-3 py-2.5 align-top">
            <button type="button" onClick={save} disabled={pending} className="rounded bg-sky-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-50">{pending ? "…" : "Save"}</button>
            <button type="button" onClick={() => { setBudget(String(node.budget || "")); setActual(String(node.actual || "")); setNote(node.note ?? ""); setEditing(false); }} className="ml-2 text-xs text-slate-500 hover:text-slate-800">Cancel</button>
          </td>
        </tr>
        <tr className="bg-sky-50/40">
          <td colSpan={8} className="px-3 pb-3">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Note — why over / under budget (for reference)</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="e.g. R&M over budget — unplanned main-engine liner replacement in Q3; approved by Fleet Mgr."
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-sky-500 focus:outline-none" />
          </td>
        </tr>
      </Fragment>
    );
  }

  return (
    <Fragment>
      <tr className="hover:bg-slate-50/60">
        <td className="px-3 py-3">
          <div className="flex items-center gap-1.5">
            {hasSubs ? (
              <button type="button" onClick={() => setOpen((o) => !o)} className="rounded p-0.5 text-slate-500 hover:bg-slate-100" aria-label={open ? "Collapse" : "Expand"}>
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            ) : <span className="inline-block w-5" />}
            <span className="font-medium text-slate-700">{node.category}</span>
            {hasSubs && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">{node.subs.length}</span>}
          </div>
          {node.note && <p className="mt-1 max-w-md whitespace-pre-wrap pl-6 text-[11px] italic text-slate-500">📝 {node.note}</p>}
        </td>
        <td className="px-3 py-3 text-right text-slate-600">{node.budget ? peso(node.budget) : "—"}</td>
        <td className="px-3 py-3 text-right text-slate-600">{node.actual ? peso(node.actual) : "—"}</td>
        <td className={`px-3 py-3 text-right font-medium ${node.budget - node.actual < 0 ? "text-red-600" : "text-emerald-700"}`}>{node.budget || node.actual ? peso(node.budget - node.actual) : "—"}</td>
        <td className={`px-3 py-3 text-right font-medium ${varCls(node.budget, node.actual)}`}>{node.budget ? pct(variancePct(node.budget, node.actual)) : "—"}</td>
        <td className="px-3 py-3 text-center text-slate-500">{node.budget ? `${util}%` : "—"}</td>
        <td className="px-3 py-3"><span className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold ${band.cls}`}>{band.label}</span></td>
        <td className="whitespace-nowrap px-3 py-3"><button type="button" onClick={() => setEditing(true)} className="text-sm font-medium text-sky-600 hover:underline">Edit</button></td>
      </tr>
      {open && node.subs.map((s) => (
        <tr key={s.name} className="bg-slate-50/40 text-slate-600">
          <td className="py-2 pl-12 pr-3 text-sm">{s.name}</td>
          <td className="px-3 py-2 text-right text-sm">{s.budget ? peso(s.budget) : "—"}</td>
          <td className="px-3 py-2 text-right text-sm">{s.actual ? peso(s.actual) : "—"}</td>
          <td className={`px-3 py-2 text-right text-sm ${s.budget - s.actual < 0 ? "text-red-600" : ""}`}>{s.budget || s.actual ? peso(s.budget - s.actual) : "—"}</td>
          <td className={`px-3 py-2 text-right text-sm ${varCls(s.budget, s.actual)}`}>{s.budget ? pct(variancePct(s.budget, s.actual)) : "—"}</td>
          <td className="px-3 py-2 text-center text-sm text-slate-400">{s.budget ? `${Math.round((s.actual / s.budget) * 100)}%` : "—"}</td>
          <td colSpan={2}></td>
        </tr>
      ))}
    </Fragment>
  );
}

export default function OpexTable({ nodes, vesselId, monthYear }: { nodes: OpexNode[]; vesselId: string; monthYear: string }) {
  const tB = nodes.reduce((s, n) => s + n.budget, 0);
  const tA = nodes.reduce((s, n) => s + n.actual, 0);

  return (
    <table className="w-full text-left text-sm">
      <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
        <tr>
          <th className="px-3 py-3 font-medium">Category</th>
          <th className="px-3 py-3 text-right font-medium">Budget</th>
          <th className="px-3 py-3 text-right font-medium">Actual</th>
          <th className="px-3 py-3 text-right font-medium">Variance</th>
          <th className="px-3 py-3 text-right font-medium">Var %</th>
          <th className="px-3 py-3 text-center font-medium">Util.</th>
          <th className="px-3 py-3 font-medium">Status</th>
          <th className="px-3 py-3 font-medium"></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {nodes.map((n) => (
          <CategoryRow key={n.category} node={n} vesselId={vesselId} monthYear={monthYear} />
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-800">
          <td className="px-3 py-3">Total</td>
          <td className="px-3 py-3 text-right">{peso(tB)}</td>
          <td className="px-3 py-3 text-right">{peso(tA)}</td>
          <td className={`px-3 py-3 text-right ${tB - tA < 0 ? "text-red-600" : "text-emerald-700"}`}>{peso(tB - tA)}</td>
          <td className={`px-3 py-3 text-right ${varCls(tB, tA)}`}>{tB ? pct(variancePct(tB, tA)) : "—"}</td>
          <td className="px-3 py-3 text-center text-slate-500">{tB ? `${Math.round((tA / tB) * 100)}%` : "—"}</td>
          <td colSpan={2} className="px-3 py-3">
            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${opexBand(tB, tA).cls}`}>{opexBand(tB, tA).label}</span>
          </td>
        </tr>
      </tfoot>
    </table>
  );
}
