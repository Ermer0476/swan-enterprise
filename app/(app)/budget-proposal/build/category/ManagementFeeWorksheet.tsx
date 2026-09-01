"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveCategoryProposal, markCategoryReview } from "../../actions";
import WorksheetActions, { type ReviewInfo } from "./WorksheetActions";

type Props = { vesselId: string; year: number; monthlyFee: number | null; months: number | null; review: ReviewInfo; isAdmin: boolean; backHref: string };

const money2 = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const parseNum = (s: string | undefined) => { const n = parseFloat((s ?? "").replace(/[, ]/g, "")); return Number.isFinite(n) ? n : 0; };

export default function ManagementFeeWorksheet({ vesselId, year, monthlyFee, months, review, isAdmin, backHref }: Props) {
  const router = useRouter();
  const [fee, setFee] = useState(monthlyFee != null ? String(monthlyFee) : "");
  const [mos, setMos] = useState(months != null ? String(months) : "12");
  const [pending, start] = useTransition();

  const annual = parseNum(fee) * parseNum(mos);

  const amberCls = "w-28 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-right text-sm tabular-nums text-slate-900 focus:border-amber-500 focus:outline-none dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-100";

  const persist = (submitted: boolean) => start(async () => {
    await saveCategoryProposal(vesselId, year, "Management Fee", [], annual, { days: parseNum(mos), rate: parseNum(fee) });
    await markCategoryReview(vesselId, year, "Management Fee", submitted);
    router.push(backHref);
  });
  const reopen = () => start(async () => { await markCategoryReview(vesselId, year, "Management Fee", false); router.refresh(); });

  return (
    <div className="mt-4">
      <fieldset disabled={review.submitted} className="min-w-0 border-0 p-0 disabled:opacity-70">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
          <span>Monthly management fee</span>
          <span>$</span>
          <input inputMode="numeric" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="7,500" className={amberCls} />
          <span className="px-1 text-slate-400">×</span>
          <input inputMode="numeric" value={mos} onChange={(e) => setMos(e.target.value)} placeholder="12" className={amberCls.replace("w-28", "w-16")} />
          <span>months</span>
          <span className="px-1 text-slate-400">=</span>
          <span className="text-lg font-bold tabular-nums text-sky-700 dark:text-sky-300">$ {money2(annual)}</span>
          <span className="text-xs text-slate-400">yearly</span>
        </div>
      </div>
      </fieldset>

      <WorksheetActions review={review} isAdmin={isAdmin} pending={pending}
        onSaveDraft={() => persist(false)} onSubmit={() => persist(true)} onReopen={reopen} onCancel={() => router.push(backHref)} />
    </div>
  );
}
