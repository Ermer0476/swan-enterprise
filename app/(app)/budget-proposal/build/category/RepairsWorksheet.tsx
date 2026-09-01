"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { saveGroupedProposal, markCategoryReview } from "../../actions";
import { REPAIRS_TEMPLATE } from "../../defaults";
import WorksheetActions, { type ReviewInfo } from "./WorksheetActions";

type Item = { name: string; amount: string; expiry: string; note: string };
type SavedGroup = { amount: number; items: { name: string; amount: number; expiry: string | null; note: string | null }[] };
type Props = { vesselId: string; year: number; saved: Record<string, SavedGroup>; carriedFrom?: number | null; lastActual: Record<string, number>; lastActualYear: number | null; review: ReviewInfo; isAdmin: boolean; backHref: string };

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const parseNum = (s: string | undefined) => { const n = parseFloat((s ?? "").replace(/[, ]/g, "")); return Number.isFinite(n) ? n : 0; };

// Enter in an amount cell jumps to the next amount cell (fast data entry).
function focusNextAmount(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key !== "Enter") return;
  e.preventDefault();
  const inputs = Array.from(document.querySelectorAll<HTMLInputElement>("input[data-amount]"));
  const next = inputs[inputs.indexOf(e.currentTarget) + 1];
  if (next) { next.focus(); next.select(); }
}

// Note field that grows with its content.
function AutoTextarea({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder: string; className: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { const el = ref.current; if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; } }, [value]);
  return (
    <textarea ref={ref} rows={1} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className={className} style={{ resize: "none", overflow: "hidden" }} />
  );
}

export default function RepairsWorksheet({ vesselId, year, saved, carriedFrom, lastActual, lastActualYear, review, isAdmin, backHref }: Props) {
  const money0 = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  const router = useRouter();

  // Seed each group's items from the template, overlaying any saved
  // amounts/expiry/notes and appending saved items that aren't in the template.
  const initItems: Record<string, Item[]> = {};
  const initFlat: Record<string, string> = {};
  for (const t of REPAIRS_TEMPLATE) {
    if (t.flat) { const sv = saved[t.group]; initFlat[t.group] = sv?.amount ? String(sv.amount) : ""; continue; }
    const savedItems = saved[t.group]?.items ?? [];
    const names = [...t.items, ...savedItems.map((s) => s.name).filter((n) => !t.items.includes(n))];
    initItems[t.group] = names.map((name) => {
      const s = savedItems.find((x) => x.name === name);
      return { name, amount: s?.amount ? String(s.amount) : "", expiry: s?.expiry ?? "", note: s?.note ?? "" };
    });
  }

  const [items, setItems] = useState<Record<string, Item[]>>(initItems);
  const [flat, setFlat] = useState<Record<string, string>>(initFlat);
  const [pending, start] = useTransition();

  const setItem = (g: string, i: number, k: keyof Item, v: string) =>
    setItems((prev) => ({ ...prev, [g]: (prev[g] ?? []).map((it, idx) => (idx === i ? { ...it, [k]: v } : it)) }));

  const addItem = (g: string) => {
    setItems((prev) => ({ ...prev, [g]: [...(prev[g] ?? []), { name: "", amount: "", expiry: "", note: "" }] }));
  };

  const removeItem = (g: string, i: number) => {
    if (!confirm(`Delete "${items[g]?.[i]?.name || "this sub-item"}"? This can't be undone once you save.`)) return;
    setItems((prev) => ({ ...prev, [g]: (prev[g] ?? []).filter((_, idx) => idx !== i) }));
  };

  const groupTotal = (t: (typeof REPAIRS_TEMPLATE)[number]) =>
    t.flat ? parseNum(flat[t.group]) : (items[t.group] ?? []).reduce((s, it) => s + parseNum(it.amount), 0);
  const catTotal = useMemo(() => REPAIRS_TEMPLATE.reduce((s, t) => s + groupTotal(t), 0), [items, flat]);

  const persist = (submitted: boolean) => start(async () => {
    const groups = REPAIRS_TEMPLATE.map((t) => t.flat
      ? { group: t.group, flat: true, amount: parseNum(flat[t.group]) }
      : { group: t.group, items: (items[t.group] ?? []).map((it) => ({ name: it.name, amount: parseNum(it.amount), expiry: it.expiry, note: it.note })) });
    await saveGroupedProposal(vesselId, year, "Repairs & Maintenance", groups);
    await markCategoryReview(vesselId, year, "Repairs & Maintenance", submitted);
    router.push(backHref);
  });
  const reopen = () => start(async () => { await markCategoryReview(vesselId, year, "Repairs & Maintenance", false); router.refresh(); });

  const amtInput = (val: string, on: (v: string) => void) => (
    <input data-amount inputMode="numeric" value={val} onChange={(e) => on(e.target.value)} onKeyDown={focusNextAmount} placeholder="amount"
      className="w-28 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-right text-sm tabular-nums text-slate-900 focus:border-amber-500 focus:outline-none dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-100" />
  );

  return (
    <div className="mt-4 space-y-3">
      <fieldset disabled={review.submitted} className="min-w-0 space-y-3 border-0 p-0 disabled:opacity-70">
      {carriedFrom != null && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-xs text-sky-800 dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-200">
          Carried over from FY {carriedFrom} — expiry dates and last figures are pre-filled. Items not yet due can stay at 0; update only what changes.
        </div>
      )}
      {REPAIRS_TEMPLATE.map((t) => (
        <div key={t.group} className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
            <span className="font-semibold text-slate-800 dark:text-slate-100">{t.group}</span>
            <div className="flex items-center gap-4">
              {lastActual[t.group] != null && <span className="text-xs text-slate-400">FY {lastActualYear} actual: <span className="tabular-nums font-medium text-slate-500 dark:text-slate-400">{money0(lastActual[t.group] ?? 0)}</span></span>}
              <span className="tabular-nums font-semibold text-sky-700 dark:text-sky-300">$ {money(groupTotal(t))}</span>
            </div>
          </div>
          {t.flat ? (
            <div className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300">
              Amount $ {amtInput(flat[t.group] ?? "", (v) => setFlat((p) => ({ ...p, [t.group]: v })))}
            </div>
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-slate-800/60">
              {(items[t.group] ?? []).map((it, i) => (
                <div key={i} className="flex flex-wrap items-start gap-x-2 gap-y-1 px-4 py-1.5 text-sm">
                  <AutoTextarea value={it.name} onChange={(v) => setItem(t.group, i, "name", v)} placeholder="item name"
                    className="min-w-[160px] flex-1 rounded-md border border-transparent px-1.5 py-1 text-slate-700 hover:border-slate-200 focus:border-sky-500 focus:outline-none dark:text-slate-200 dark:hover:border-slate-700" />
                  <AutoTextarea value={it.note} onChange={(v) => setItem(t.group, i, "note", v)} placeholder="note"
                    className="min-w-[200px] flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 focus:border-sky-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
                  {t.expiry && (
                    <label className="flex items-center gap-1 pt-1.5 text-[11px] text-slate-400">exp.
                      <input type="date" value={it.expiry} onChange={(e) => setItem(t.group, i, "expiry", e.target.value)}
                        className="w-36 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 focus:border-sky-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:[color-scheme:dark]" />
                    </label>
                  )}
                  {amtInput(it.amount, (v) => setItem(t.group, i, "amount", v))}
                  <button onClick={() => removeItem(t.group, i)} title="Delete item"
                    className="mt-0.5 rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <div className="px-4 py-1.5">
                <button onClick={() => addItem(t.group)} className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-sky-600">
                  <Plus className="h-3 w-3" /> Add sub-item
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      <div className="flex items-center justify-between rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
        <span className="font-semibold text-slate-700 dark:text-slate-100">Repairs &amp; Maintenance total</span>
        <span className="tabular-nums text-lg font-bold text-sky-700 dark:text-sky-300">$ {money(catTotal)}</span>
      </div>
      </fieldset>

      <WorksheetActions review={review} isAdmin={isAdmin} pending={pending}
        onSaveDraft={() => persist(false)} onSubmit={() => persist(true)} onReopen={reopen} onCancel={() => router.push(backHref)} />
    </div>
  );
}
