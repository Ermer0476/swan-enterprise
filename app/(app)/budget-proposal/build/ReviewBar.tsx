"use client";

import { useState, useTransition } from "react";
import { ClipboardCheck, Check } from "lucide-react";
import { saveBudgetReview } from "../actions";

const badgeCls: Record<string, string> = {
  "Drafting": "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  "For Review": "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

// Status is DERIVED (not a manual dropdown): it becomes "For Review" automatically
// once every budgeted category is completed/submitted, otherwise it's "Drafting".
export default function ReviewBar({ vesselId, year, status, note }: { vesselId: string; year: number; status: string; note: string | null }) {
  const [nt, setNt] = useState(note || "");
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const persist = () => start(async () => { await saveBudgetReview(vesselId, year, status, nt); setSaved(true); setTimeout(() => setSaved(false), 1500); });

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300"><ClipboardCheck className="h-4 w-4 text-slate-400" /> Review status</span>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeCls[status] ?? badgeCls.Drafting}`}>{status}</span>
        <span className="text-[11px] text-slate-400">auto — turns “For Review” once every category is completed</span>
        <input value={nt} onChange={(e) => setNt(e.target.value)} onBlur={persist}
          placeholder="Note — e.g. Reviewed by Tech & Marine 07/25, pending Fleet Mgr"
          className="min-w-[260px] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 focus:border-sky-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
        {pending && <span className="text-xs text-slate-400">saving…</span>}
        {saved && !pending && <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><Check className="h-3.5 w-3.5" /> saved</span>}
      </div>
    </div>
  );
}
