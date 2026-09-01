"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Wand2, Plus } from "lucide-react";
import { saveCategoryProposal, markCategoryReview, type ProposalParticular } from "../../actions";
import WorksheetActions, { type ReviewInfo } from "./WorksheetActions";

type YearData = { budget: number; actual: number };
type Prop = { amount: number; days: number | null; qty: number | null; rate: number | null; basis: string | null };
type Props = {
  vesselId: string;
  year: number;
  category: string;
  particulars: string[];
  histYears: number[];
  history: Record<string, Record<number, YearData>>; // key "" = category level
  proposed: Record<string, Prop>;
  review: ReviewInfo;
  isAdmin: boolean;
  backHref: string;
};

const money = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const money2 = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const parseNum = (s: string | undefined) => { const n = parseFloat((s ?? "").replace(/[, ]/g, "")); return Number.isFinite(n) ? n : 0; };
const str = (v: number | null | undefined) => (v != null ? String(v) : "");

export default function CategoryEditor({ vesselId, year, category, particulars, histYears, history, proposed, review, isAdmin, backHref }: Props) {
  const router = useRouter();
  const lastYear = histYears[histYears.length - 1];
  const [extra, setExtra] = useState<string[]>([]);
  const parts = useMemo(() => [...particulars, ...extra], [particulars, extra]);
  const lump = parts.length === 0;
  const keys = lump ? [""] : parts;

  const init = <T,>(pick: (p: Prop) => T) => Object.fromEntries(Object.entries(proposed).map(([k, v]) => [k, pick(v)]));
  const [daysS, setDaysS] = useState<Record<string, string>>(() => init((p) => str(p.days)));
  const [qtyS, setQtyS] = useState<Record<string, string>>(() => init((p) => str(p.qty)));
  const [rateS, setRateS] = useState<Record<string, string>>(() => init((p) => str(p.rate)));
  const [amtS, setAmtS] = useState<Record<string, string>>(() => init((p) => str(p.amount)));
  const [basisS, setBasisS] = useState<Record<string, string>>(() => init((p) => p.basis ?? ""));
  const [pending, start] = useTransition();

  // Amount is computed when Qty & Rate are both entered — for oils that's
  // Days × Ltrs/day × Rate (Days optional, treated as 1 when blank); for simple
  // items it's Qty × Rate. Otherwise the directly-typed amount is used.
  const hasQR = (k: string) => !!qtyS[k]?.trim() && !!rateS[k]?.trim();
  const amountOf = (k: string) => {
    if (!hasQR(k)) return parseNum(amtS[k] ?? "");
    const days = daysS[k]?.trim() ? parseNum(daysS[k]) : 1;
    return days * parseNum(qtyS[k]) * parseNum(rateS[k]);
  };

  const seed = (basis: "actual" | "budget") => {
    const nextAmt = { ...amtS }, clrD = { ...daysS }, clrQ = { ...qtyS }, clrR = { ...rateS };
    for (const k of keys) {
      const d = lastYear ? history[k]?.[lastYear] : undefined;
      const v = d ? (basis === "actual" ? d.actual : d.budget) : 0;
      nextAmt[k] = v ? String(Math.round(v)) : "";
      clrD[k] = ""; clrQ[k] = ""; clrR[k] = ""; // use the seeded amount directly
    }
    setAmtS(nextAmt); setDaysS(clrD); setQtyS(clrQ); setRateS(clrR);
  };

  const addParticular = () => {
    const name = prompt(`New particular under ${category}:`)?.trim();
    if (!name || parts.some((s) => s.toLowerCase() === name.toLowerCase())) return;
    setExtra((e) => [...e, name]);
  };

  const subtotal = useMemo(() => keys.reduce((s, k) => s + amountOf(k), 0), [keys, daysS, qtyS, rateS, amtS]);
  const lastActual = lastYear ? history[""]?.[lastYear]?.actual ?? 0 : 0;
  const deltaPct = lastActual > 0 && subtotal > 0 ? ((subtotal - lastActual) / lastActual) * 100 : null;

  const persist = (submitted: boolean) => start(async () => {
    const n = (v: string | undefined) => (v?.trim() ? parseNum(v) : null);
    if (lump) {
      await saveCategoryProposal(vesselId, year, category, [], amountOf(""),
        { days: n(daysS[""]), qty: n(qtyS[""]), rate: n(rateS[""]), basis: basisS[""] ?? null });
    } else {
      const lines: ProposalParticular[] = parts.map((s) => ({
        subCategory: s,
        amount: amountOf(s),
        days: n(daysS[s]),
        qty: n(qtyS[s]),
        rate: n(rateS[s]),
        basis: basisS[s] ?? null,
      }));
      await saveCategoryProposal(vesselId, year, category, lines);
    }
    await markCategoryReview(vesselId, year, category, submitted);
    router.push(backHref);
  });
  const reopen = () => start(async () => { await markCategoryReview(vesselId, year, category, false); router.refresh(); });

  const numInput = (val: string, on: (v: string) => void, w: string, ph = "") => (
    <input inputMode="numeric" value={val} onChange={(e) => on(e.target.value)} placeholder={ph}
      className={`${w} rounded-lg border border-slate-300 px-2 py-1.5 text-right text-sm tabular-nums text-slate-800 focus:border-sky-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100`} />
  );

  const Row = (key: string, label: string, indent: boolean) => {
    const computed = hasQR(key);
    return (
      <tr key={key || "__lump"} className="align-top hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
        <td className={`py-2 pr-3 text-slate-600 dark:text-slate-300 ${indent ? "pl-6" : "pl-4 font-medium"}`}>{label}</td>
        {histYears.map((y) => (
          <td key={y} className="px-3 py-2 text-right tabular-nums text-slate-500 dark:text-slate-400">
            {history[key]?.[y] != null ? money(history[key][y].actual) : <span className="text-slate-300 dark:text-slate-600">—</span>}
          </td>
        ))}
        <td className="px-2 py-1.5 text-right">{numInput(daysS[key] ?? "", (v) => setDaysS((a) => ({ ...a, [key]: v })), "w-16", "days")}</td>
        <td className="px-2 py-1.5 text-right">{numInput(qtyS[key] ?? "", (v) => setQtyS((a) => ({ ...a, [key]: v })), "w-20", "ltrs/day")}</td>
        <td className="px-2 py-1.5 text-right">{numInput(rateS[key] ?? "", (v) => setRateS((a) => ({ ...a, [key]: v })), "w-20", "rate")}</td>
        <td className="px-2 py-1.5 text-right">
          {computed
            ? <div className="w-28 rounded-lg bg-slate-100 px-2 py-1.5 text-right text-sm font-semibold tabular-nums text-slate-700 dark:bg-slate-800 dark:text-slate-200">{money2(amountOf(key))}</div>
            : numInput(amtS[key] ?? "", (v) => setAmtS((a) => ({ ...a, [key]: v })), "w-28", "amount")}
        </td>
        <td className="px-2 py-1.5">
          <input value={basisS[key] ?? ""} onChange={(e) => setBasisS((a) => ({ ...a, [key]: e.target.value }))}
            placeholder="e.g. 78 L/day × 175 days · ROB note"
            className="w-64 rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-700 focus:border-sky-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
        </td>
      </tr>
    );
  };

  return (
    <div className="mt-4">
      <fieldset disabled={review.submitted} className="min-w-0 border-0 p-0 disabled:opacity-70">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500 dark:text-slate-400">Quick start:</span>
        <button onClick={() => seed("actual")} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <Wand2 className="h-3.5 w-3.5" /> Seed amounts from FY {lastYear ?? "—"} actual
        </button>
        <span className="ml-auto text-[11px] text-slate-400">Oils: Days × Ltrs/day × Rate. Simple items: leave Days blank (Qty × Rate). Or type the Amount directly. Basis explains the figure.</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400 dark:border-slate-700 dark:bg-slate-800">
            <tr>
              <th className="px-4 py-3 font-semibold">Particular</th>
              {histYears.map((y) => <th key={y} className="px-3 py-3 text-right font-semibold">FY {y}<div className="font-normal normal-case text-slate-400">actual</div></th>)}
              <th className="px-2 py-3 text-right font-semibold">Days<div className="font-normal normal-case text-slate-400">optional</div></th>
              <th className="px-2 py-3 text-right font-semibold">Ltrs/day<div className="font-normal normal-case text-slate-400">or qty</div></th>
              <th className="px-2 py-3 text-right font-semibold">Rate</th>
              <th className="px-2 py-3 text-right font-semibold text-sky-700 dark:text-sky-300">Amount</th>
              <th className="px-2 py-3 font-semibold">Basis / remarks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {lump ? Row("", `${category} (whole category)`, false) : parts.map((s) => Row(s, s, true))}
            <tr>
              <td className={`py-1 pr-4 ${lump ? "pl-4" : "pl-6"}`} colSpan={histYears.length + 6}>
                <button onClick={addParticular} className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-sky-600">
                  <Plus className="h-3 w-3" /> Add particular
                </button>
              </td>
            </tr>
          </tbody>
          <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-semibold dark:border-slate-700 dark:bg-slate-800">
            <tr>
              <td className="px-4 py-3 text-slate-700 dark:text-slate-100">{category} total</td>
              {histYears.map((y) => (
                <td key={y} className="px-3 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">{history[""]?.[y] != null ? money(history[""][y].actual) : "—"}</td>
              ))}
              <td colSpan={3} />
              <td className="px-2 py-3 text-right tabular-nums text-sky-700 dark:text-sky-300">
                {money2(subtotal)}
                {deltaPct != null && <div className={`text-[11px] font-medium ${deltaPct > 0 ? "text-red-500" : "text-emerald-600"}`}>{deltaPct > 0 ? "+" : ""}{deltaPct.toFixed(1)}% vs FY {lastYear}</div>}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      </fieldset>

      <WorksheetActions review={review} isAdmin={isAdmin} pending={pending}
        onSaveDraft={() => persist(false)} onSubmit={() => persist(true)} onReopen={reopen} onCancel={() => router.push(backHref)} />
    </div>
  );
}
