"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Plus, Trash2 } from "lucide-react";
import { saveCrewingProposal } from "../../actions";
import { CREW_LINES, type ManningRow, type CrewItem } from "../../defaults";

type MRow = { rank: string; count: string; wage: string };
type IRow = { name: string; line: string; amount: string };
type Props = {
  vesselId: string;
  year: number;
  manning: ManningRow[];
  items: CrewItem[];
  backHref: string;
};

const money = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const money2 = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const parseNum = (s: string | undefined) => { const n = parseFloat((s ?? "").replace(/[, ]/g, "")); return Number.isFinite(n) ? n : 0; };

export default function CrewingWorksheet({ vesselId, year, manning, items, backHref }: Props) {
  const router = useRouter();
  const [mrows, setMrows] = useState<MRow[]>(() => manning.map((m) => ({ rank: m.rank, count: String(m.count), wage: String(m.wage) })));
  const [irows, setIrows] = useState<IRow[]>(() => items.map((i) => ({ name: i.name, line: i.line, amount: String(i.amount) })));
  const [pending, start] = useTransition();

  const setM = (i: number, k: keyof MRow, v: string) => setMrows((p) => p.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const setI = (i: number, k: keyof IRow, v: string) => setIrows((p) => p.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));

  const manningMonthly = useMemo(() => mrows.reduce((s, m) => s + parseNum(m.count) * parseNum(m.wage), 0), [mrows]);

  // Monthly + annual per Crew Cost line.
  const lineMonthly = (line: string) =>
    (line === "Crew Wages" ? manningMonthly : 0) + irows.filter((i) => i.line === line).reduce((s, i) => s + parseNum(i.amount), 0);
  const annual = useMemo(() => Object.fromEntries(CREW_LINES.map((l) => [l, lineMonthly(l) * 12])), [mrows, irows]);
  const monthlyFee = useMemo(() => CREW_LINES.reduce((s, l) => s + lineMonthly(l), 0), [mrows, irows]);
  const total = monthlyFee * 12;

  const save = () => start(async () => {
    const m: ManningRow[] = mrows.filter((r) => r.rank.trim()).map((r) => ({ rank: r.rank.trim(), count: parseNum(r.count), wage: parseNum(r.wage) }));
    const it: CrewItem[] = irows.filter((r) => r.name.trim()).map((r) => ({ name: r.name.trim(), line: r.line, amount: parseNum(r.amount) }));
    await saveCrewingProposal(vesselId, year, m, it);
    router.push(backHref);
  });

  const numCls = "w-20 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-right text-sm tabular-nums text-slate-900 focus:border-amber-500 focus:outline-none dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-100";
  const txtCls = "min-w-[140px] flex-1 rounded-md border border-transparent px-1.5 py-1 text-sm text-slate-700 hover:border-slate-200 focus:border-sky-500 focus:outline-none dark:text-slate-200 dark:hover:border-slate-700";
  const delBtn = (fn: () => void) => (
    <button onClick={fn} title="Delete" className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30"><Trash2 className="h-4 w-4" /></button>
  );

  return (
    <div className="mt-4 space-y-4">
      {/* Manning scale */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
          <span className="font-semibold text-slate-800 dark:text-slate-100">Manning Scale</span>
          <span className="text-xs text-slate-500">Monthly wages: <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">$ {money(manningMonthly)}</span></span>
        </div>
        <div className="grid grid-cols-[1fr_70px_100px_110px_36px] gap-2 border-b border-slate-100 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:border-slate-800">
          <div>Rank</div><div className="text-right">Count</div><div className="text-right">$/mo each</div><div className="text-right">Subtotal</div><div />
        </div>
        <div className="divide-y divide-slate-50 dark:divide-slate-800/60">
          {mrows.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_70px_100px_110px_36px] items-center gap-2 px-4 py-1">
              <input value={r.rank} onChange={(e) => setM(i, "rank", e.target.value)} placeholder="rank" className={txtCls} />
              <input inputMode="numeric" value={r.count} onChange={(e) => setM(i, "count", e.target.value)} className={numCls.replace("w-20", "w-full")} />
              <input inputMode="numeric" value={r.wage} onChange={(e) => setM(i, "wage", e.target.value)} className={numCls.replace("w-20", "w-full")} />
              <div className="text-right text-sm tabular-nums text-slate-600 dark:text-slate-300">{money(parseNum(r.count) * parseNum(r.wage))}</div>
              {delBtn(() => setMrows((p) => p.filter((_, idx) => idx !== i)))}
            </div>
          ))}
        </div>
        <div className="px-4 py-1.5">
          <button onClick={() => setMrows((p) => [...p, { rank: "", count: "1", wage: "" }])} className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-sky-600"><Plus className="h-3 w-3" /> Add crew position</button>
        </div>
      </div>

      {/* Monthly cost items */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-4 py-2.5 dark:border-slate-800"><span className="font-semibold text-slate-800 dark:text-slate-100">Monthly Cost Items</span></div>
        <div className="grid grid-cols-[1fr_220px_110px_36px] gap-2 border-b border-slate-100 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:border-slate-800">
          <div>Item</div><div>Rolls into</div><div className="text-right">$/mo</div><div />
        </div>
        <div className="divide-y divide-slate-50 dark:divide-slate-800/60">
          {irows.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_220px_110px_36px] items-center gap-2 px-4 py-1">
              <input value={r.name} onChange={(e) => setI(i, "name", e.target.value)} placeholder="item" className={txtCls} />
              <select value={r.line} onChange={(e) => setI(i, "line", e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:border-sky-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                {CREW_LINES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              <input inputMode="numeric" value={r.amount} onChange={(e) => setI(i, "amount", e.target.value)} className={numCls.replace("w-20", "w-full")} />
              {delBtn(() => setIrows((p) => p.filter((_, idx) => idx !== i)))}
            </div>
          ))}
        </div>
        <div className="px-4 py-1.5">
          <button onClick={() => setIrows((p) => [...p, { name: "", line: "Miscellaneous", amount: "" }])} className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-sky-600"><Plus className="h-3 w-3" /> Add monthly item</button>
        </div>
      </div>

      {/* Computed 7 Crew Cost lines */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-4 py-2.5 text-xs text-slate-500 dark:border-slate-800">Crew Cost lines (× 12 months) — these feed the budget summary</div>
        <table className="w-full text-left text-sm">
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {CREW_LINES.map((l) => (
              <tr key={l}>
                <td className="px-4 py-2 text-slate-700 dark:text-slate-200">{l}</td>
                <td className="px-4 py-2 text-right tabular-nums text-slate-500 dark:text-slate-400">{money(lineMonthly(l))}<span className="text-[10px] text-slate-400">/mo</span></td>
                <td className="px-4 py-2 text-right tabular-nums font-semibold text-sky-700 dark:text-sky-300">{money2(annual[l] ?? 0)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-semibold dark:border-slate-700 dark:bg-slate-800">
            <tr>
              <td className="px-4 py-3 text-slate-700 dark:text-slate-100">Crewing total</td>
              <td className="px-4 py-3 text-right tabular-nums text-slate-500 dark:text-slate-400">{money(monthlyFee)}<span className="text-[10px]">/mo</span></td>
              <td className="px-4 py-3 text-right tabular-nums text-sky-700 dark:text-sky-300">$ {money2(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={save} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">
          <Save className="h-4 w-4" /> {pending ? "Saving…" : "Save & back to proposal"}
        </button>
        <button onClick={() => router.push(backHref)} className="text-sm text-slate-500 hover:text-slate-700">Cancel</button>
      </div>
    </div>
  );
}
