"use client";

import { useState, useTransition } from "react";
import { CalendarRange, Check } from "lucide-react";
import { saveBudgetPeriod } from "../actions";

// "2026-01" -> "Jan 2026"
function fmt(m: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(m);
  if (!match) return "";
  const d = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export default function BudgetPeriodBar({ vesselId, year, start, end }: { vesselId: string; year: number; start: string; end: string }) {
  const [s, setS] = useState(start || "");
  const [e, setE] = useState(end || "");
  const [pending, startTr] = useTransition();
  const [saved, setSaved] = useState(false);

  const persist = (ns: string, ne: string) => startTr(async () => { await saveBudgetPeriod(vesselId, year, ns, ne); setSaved(true); setTimeout(() => setSaved(false), 1500); });

  const label = s && e ? `${fmt(s)} – ${fmt(e)}` : "Set the months this budget covers";

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300"><CalendarRange className="h-4 w-4 text-slate-400" /> Budget period</span>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${s && e ? "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"}`}>{label}</span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-slate-400">From
            <input type="month" value={s} onChange={(ev) => { setS(ev.target.value); persist(ev.target.value, e); }}
              className="rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-700 focus:border-sky-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:[color-scheme:dark]" />
          </label>
          <label className="flex items-center gap-1 text-xs text-slate-400">To
            <input type="month" value={e} onChange={(ev) => { setE(ev.target.value); persist(s, ev.target.value); }}
              className="rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-700 focus:border-sky-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:[color-scheme:dark]" />
          </label>
        </div>
        {pending && <span className="text-xs text-slate-400">saving…</span>}
        {saved && !pending && <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><Check className="h-3.5 w-3.5" /> saved</span>}
      </div>
    </div>
  );
}
