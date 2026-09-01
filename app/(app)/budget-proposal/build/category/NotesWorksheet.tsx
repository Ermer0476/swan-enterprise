"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { saveCategoryProposal, markCategoryReview, type ProposalParticular } from "../../actions";
import WorksheetActions, { type ReviewInfo } from "./WorksheetActions";

type Row = { name: string; note: string; amount: string };
type Props = {
  vesselId: string;
  year: number;
  category: string;
  particulars: string[];
  proposed: Record<string, { amount: number; basis: string | null }>;
  lastActual: Record<string, number>;
  lastBudget: Record<string, number>;
  lastActualYear: number | null;
  review: ReviewInfo;
  isAdmin: boolean;
  backHref: string;
};

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const parseNum = (s: string | undefined) => { const n = parseFloat((s ?? "").replace(/[, ]/g, "")); return Number.isFinite(n) ? n : 0; };

// Enter in an amount cell jumps to the next amount cell (fast data entry).
function focusNextAmount(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key !== "Enter") return;
  e.preventDefault();
  const inputs = Array.from(document.querySelectorAll<HTMLInputElement>("input[data-amount]"));
  const i = inputs.indexOf(e.currentTarget);
  const next = inputs[i + 1];
  if (next) { next.focus(); next.select(); }
}

// Note field that grows with its content.
function AutoTextarea({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder: string; className: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { const el = ref.current; if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; } }, [value]);
  return <textarea ref={ref} rows={1} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={className} style={{ resize: "none", overflow: "hidden" }} />;
}

export default function NotesWorksheet({ vesselId, year, category, particulars, proposed, lastActual, lastBudget, lastActualYear, review, isAdmin, backHref }: Props) {
  const router = useRouter();
  const money0 = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });

  // Seed rows from the particular list (proposed amounts/notes overlaid), then
  // append any saved particulars not in the base list.
  const base = [...particulars, ...Object.keys(proposed).filter((n) => n && !particulars.includes(n))];
  const [rows, setRows] = useState<Row[]>(() =>
    base.map((name) => ({ name, note: proposed[name]?.basis ?? "", amount: proposed[name]?.amount ? String(proposed[name].amount) : "" })),
  );
  const [pending, start] = useTransition();

  const setRow = (i: number, k: keyof Row, v: string) => setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const addRow = () => setRows((prev) => [...prev, { name: "", note: "", amount: "" }]);
  const removeRow = (i: number) => {
    if (!confirm(`Delete "${rows[i]?.name || "this item"}"? This can't be undone once you save.`)) return;
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  };

  const total = useMemo(() => rows.reduce((s, r) => s + parseNum(r.amount), 0), [rows]);

  const persist = (submitted: boolean) => start(async () => {
    const lines: ProposalParticular[] = rows.filter((r) => r.name.trim()).map((r) => ({ subCategory: r.name.trim(), amount: parseNum(r.amount), basis: r.note }));
    await saveCategoryProposal(vesselId, year, category, lines);
    await markCategoryReview(vesselId, year, category, submitted);
    router.push(backHref);
  });
  const reopen = () => start(async () => { await markCategoryReview(vesselId, year, category, false); router.refresh(); });

  return (
    <div className="mt-4">
      <p className="mb-2 text-[11px] text-slate-400">Add a note with the item&apos;s details, then the amount. Prior-year actuals show back on the summary.</p>
      <fieldset disabled={review.submitted} className="min-w-0 border-0 p-0 disabled:opacity-70">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="grid grid-cols-[minmax(140px,1fr)_minmax(150px,2fr)_100px_100px_120px_36px] gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:border-slate-700 dark:bg-slate-800">
          <div>Particular</div><div>Note / details</div><div className="text-right">{lastActualYear ? `FY ${lastActualYear} budget` : "Last budget"}</div><div className="text-right">{lastActualYear ? `FY ${lastActualYear} actual` : "Last actual"}</div><div className="text-right text-sky-700 dark:text-sky-300">Amount</div><div />
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[minmax(140px,1fr)_minmax(150px,2fr)_100px_100px_120px_36px] items-start gap-2 px-4 py-2">
              <AutoTextarea value={r.name} onChange={(v) => setRow(i, "name", v)} placeholder="item name"
                className="mt-0.5 rounded-md border border-transparent px-1.5 py-1 text-sm text-slate-700 hover:border-slate-200 focus:border-sky-500 focus:outline-none dark:text-slate-200 dark:hover:border-slate-700" />
              <AutoTextarea value={r.note} onChange={(v) => setRow(i, "note", v)} placeholder="details / basis of the amount"
                className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 focus:border-sky-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
              <div className="mt-1.5 text-right text-sm tabular-nums text-slate-400">{lastBudget[r.name] != null ? money0(lastBudget[r.name] ?? 0) : "—"}</div>
              <div className="mt-1.5 text-right text-sm tabular-nums text-slate-400">{lastActual[r.name] != null ? money0(lastActual[r.name] ?? 0) : "—"}</div>
              <input data-amount inputMode="numeric" value={r.amount} onChange={(e) => setRow(i, "amount", e.target.value)} onKeyDown={focusNextAmount} placeholder="amount"
                className="mt-0.5 w-full rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-right text-sm tabular-nums text-slate-900 focus:border-amber-500 focus:outline-none dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-100" />
              <button onClick={() => removeRow(i)} title="Delete item" className="mt-1 rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="px-4 py-2">
          <button onClick={addRow} className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-sky-600">
            <Plus className="h-3 w-3" /> Add particular
          </button>
        </div>
        <div className="flex items-center justify-between border-t-2 border-slate-200 bg-slate-50 px-4 py-3 font-semibold dark:border-slate-700 dark:bg-slate-800">
          <span className="text-slate-700 dark:text-slate-100">{category} total</span>
          <span className="tabular-nums text-sky-700 dark:text-sky-300">$ {money(total)}</span>
        </div>
      </div>
      </fieldset>

      <WorksheetActions review={review} isAdmin={isAdmin} pending={pending}
        onSaveDraft={() => persist(false)} onSubmit={() => persist(true)} onReopen={reopen} onCancel={() => router.push(backHref)} />
    </div>
  );
}
