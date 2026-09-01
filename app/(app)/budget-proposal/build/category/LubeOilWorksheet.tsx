"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveWorksheetProposal, markCategoryReview, type ProposalParticular } from "../../actions";
import WorksheetActions, { type ReviewInfo } from "./WorksheetActions";

type Prop = { amount: number; days: number | null; qty: number | null; rate: number | null; rob: number | null; orderQty: number | null; basis: string | null };
type Props = {
  vesselId: string;
  year: number;
  proposed: Record<string, Prop>;
  header: { days: number | null; basis: string | null };
  review: ReviewInfo;
  isAdmin: boolean;
  backHref: string;
};

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const parseNum = (s: string | undefined) => { const n = parseFloat((s ?? "").replace(/[, ]/g, "")); return Number.isFinite(n) ? n : 0; };
const str = (v: number | null | undefined) => (v != null ? String(v) : "");

// The Lubricating Oils worksheet rows, mirroring Swan's Excel. Fixed labels; the
// blanks are inputs. oil = Ltrs/day × Rate × Days; sample = Rate × Count; flat =
// a directly-typed amount.
const ROWS: { name: string; kind: "oil" | "sample" | "flat"; suffix?: string; desc?: string }[] = [
  { name: "Main Engine Cylinder Oil", kind: "oil", suffix: "(Normal running)" },
  { name: "Main Engine System Oil", kind: "oil" },
  { name: "Generator Engine System Oil (incl. oil change)", kind: "oil", suffix: "(Average)" },
  { name: "Miscellaneous Oils", kind: "flat", desc: "other oils apart from above" },
  { name: "Handling / Delivery", kind: "flat", desc: "including handling for LO samples" },
  { name: "Bunker Analysis Fee", kind: "sample" },
  { name: "Lube Oil Test Kit (24 bottles)", kind: "flat" },
];

const parseHeader = (basis: string | null) => {
  const spot = basis?.match(/spot:([^|]*)/)?.[1]?.trim() ?? "";
  const supply = basis?.match(/supply:(.*)$/)?.[1]?.trim() ?? "";
  return { spot, supply };
};

// Note field that grows with its content.
function AutoTextarea({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder: string; className: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { const el = ref.current; if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; } }, [value]);
  return <textarea ref={ref} rows={1} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={className} style={{ resize: "none", overflow: "hidden" }} />;
}

export default function LubeOilWorksheet({ vesselId, year, proposed, header, review, isAdmin, backHref }: Props) {
  const router = useRouter();
  const h0 = parseHeader(header.basis);
  const [seaDays, setSeaDays] = useState(str(header.days));
  const [spot, setSpot] = useState(h0.spot);
  const [supply, setSupply] = useState(h0.supply);

  const field = <T,>(pick: (p: Prop) => T, dflt: T) =>
    Object.fromEntries(ROWS.map((r) => { const p = proposed[r.name]; return [r.name, p ? pick(p) : dflt]; })) as Record<string, T>;
  const [qtyS, setQtyS] = useState<Record<string, string>>(() => field((p) => str(p.qty), ""));
  const [rateS, setRateS] = useState<Record<string, string>>(() => field((p) => str(p.rate), ""));
  const [daysS, setDaysS] = useState<Record<string, string>>(() => field((p) => str(p.days), ""));
  const [robS, setRobS] = useState<Record<string, string>>(() => field((p) => str(p.rob), ""));
  // Notes default to each row's descriptive text (editable), then any saved note.
  const [basisS, setBasisS] = useState<Record<string, string>>(() =>
    Object.fromEntries(ROWS.map((r) => [r.name, proposed[r.name]?.basis != null ? proposed[r.name]!.basis! : (r.desc ?? "")])),
  );
  const [amtS, setAmtS] = useState<Record<string, string>>(() => field((p) => str(p.amount), ""));
  const [pending, start] = useTransition();

  // Oils: (Ltrs/day × Days − ROB) × Rate. Consumption for the year less what is
  // already on board is the net quantity to purchase (clamped at 0).
  const consumptionOf = (name: string) => parseNum(qtyS[name]) * parseNum(daysS[name]);
  const netQtyOf = (name: string) => Math.max(0, consumptionOf(name) - parseNum(robS[name]));
  const amountOf = (r: (typeof ROWS)[number]) => {
    if (r.kind === "oil") return netQtyOf(r.name) * parseNum(rateS[r.name]);
    if (r.kind === "sample") return parseNum(rateS[r.name]) * parseNum(qtyS[r.name]);
    return parseNum(amtS[r.name]);
  };
  const total = useMemo(() => ROWS.reduce((s, r) => s + amountOf(r), 0), [qtyS, rateS, daysS, robS, amtS]);

  const numI = (val: string, on: (v: string) => void, w = "w-16", ph = "") => (
    <input inputMode="numeric" value={val} onChange={(e) => on(e.target.value)} placeholder={ph}
      className={`${w} rounded-md border border-amber-300 bg-amber-50 px-1.5 py-1 text-right text-sm tabular-nums text-slate-900 focus:border-amber-500 focus:outline-none dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-100`} />
  );
  const set = (setter: React.Dispatch<React.SetStateAction<Record<string, string>>>) => (name: string, v: string) => setter((a) => ({ ...a, [name]: v }));
  const sQty = set(setQtyS), sRate = set(setRateS), sDays = set(setDaysS), sRob = set(setRobS), sBasis = set(setBasisS), sAmt = set(setAmtS);

  // Editable, auto-growing note cell for a row.
  const noteI = (name: string, ph: string) => (
    <div className="mt-2 flex items-start gap-2">
      <span className="pt-1 text-[11px] text-slate-400">note</span>
      <AutoTextarea value={basisS[name] ?? ""} onChange={(v) => sBasis(name, v)} placeholder={ph}
        className="w-full max-w-xl rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 focus:border-sky-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
    </div>
  );

  const persist = (submitted: boolean) => start(async () => {
    const n = (v: string | undefined) => (v?.trim() ? parseNum(v) : null);
    const rows: ProposalParticular[] = ROWS.map((r) => ({
      subCategory: r.name,
      amount: amountOf(r),
      days: r.kind === "oil" ? n(daysS[r.name]) : null,
      qty: r.kind === "flat" ? null : n(qtyS[r.name]),
      rate: r.kind === "flat" ? null : n(rateS[r.name]),
      rob: r.kind === "oil" ? n(robS[r.name]) : null,
      orderQty: r.kind === "oil" ? netQtyOf(r.name) : null,
      basis: basisS[r.name] ?? null,
    }));
    await saveWorksheetProposal(vesselId, year, "Lubricating Oil", rows, {
      days: seaDays.trim() ? parseNum(seaDays) : null,
      basis: `spot:${spot}||supply:${supply}`,
    });
    await markCategoryReview(vesselId, year, "Lubricating Oil", submitted);
    router.push(backHref);
  });
  const reopen = () => start(async () => { await markCategoryReview(vesselId, year, "Lubricating Oil", false); router.refresh(); });

  return (
    <div className="mt-4">
      <fieldset disabled={review.submitted} className="min-w-0 border-0 p-0 disabled:opacity-70">
      {/* Header assumptions */}
      <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
        Based on {numI(seaDays, (v) => setSeaDays(v), "w-16", "175")} sea steaming days per year and the present average spot rate from{" "}
        <input value={spot} onChange={(e) => setSpot(e.target.value)} placeholder="Murakami Sekiyu"
          className="w-40 rounded-md border border-amber-300 bg-amber-50 px-1.5 py-1 text-sm text-slate-900 focus:border-amber-500 focus:outline-none dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-100" /> basis, supply in{" "}
        <input value={supply} onChange={(e) => setSupply(e.target.value)} placeholder="Saldanha Bay, SA"
          className="w-40 rounded-md border border-amber-300 bg-amber-50 px-1.5 py-1 text-sm text-slate-900 focus:border-amber-500 focus:outline-none dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-100" />.
      </div>

      <div className="space-y-2">
        {ROWS.map((r) => (
          <div key={r.name} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-semibold text-slate-800 dark:text-slate-100">{r.name}:</span>
              <span className="tabular-nums text-base font-semibold text-sky-700 dark:text-sky-300">$ {money(amountOf(r))}</span>
            </div>

            {r.kind === "oil" && (
              <div className="mt-2 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
                  {numI(qtyS[r.name] ?? "", (v) => sQty(r.name, v), "w-16", "L/day")} Ltrs/day
                  <span className="px-1 text-slate-400">×</span> {numI(daysS[r.name] ?? "", (v) => sDays(r.name, v), "w-16", "days")} Days
                  {r.suffix && <span className="text-slate-400">{r.suffix}</span>}
                  <span className="px-1 text-slate-400">=</span>
                  <span className="font-medium tabular-nums text-slate-700 dark:text-slate-200">{Math.round(consumptionOf(r.name)).toLocaleString()} L</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
                  <span className="text-slate-400">−  ROB</span> {numI(robS[r.name] ?? "", (v) => sRob(r.name, v), "w-20", "L on board")} L
                  <span className="px-1 text-slate-400">=</span>
                  <span className="font-medium tabular-nums text-emerald-700 dark:text-emerald-300">{Math.round(netQtyOf(r.name)).toLocaleString()} L to buy</span>
                  <span className="px-1 text-slate-400">×</span> $ {numI(rateS[r.name] ?? "", (v) => sRate(r.name, v), "w-16", "rate")}
                </div>
                {noteI(r.name, "ROB note — e.g. 18,800 L good for 10 months")}
              </div>
            )}
            {r.kind === "sample" && (
              <>
                <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-2 text-sm text-slate-600 dark:text-slate-300">
                  $ {numI(rateS[r.name] ?? "", (v) => sRate(r.name, v), "w-16", "200")} per sample for an estimate of {numI(qtyS[r.name] ?? "", (v) => sQty(r.name, v), "w-14", "22")} samples a year
                </div>
                {noteI(r.name, "note / details")}
              </>
            )}
            {r.kind === "flat" && (
              <>
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-slate-600 dark:text-slate-300">
                  Amount $ {numI(amtS[r.name] ?? "", (v) => sAmt(r.name, v), "w-28", "amount")}
                </div>
                {noteI(r.name, "note / details")}
              </>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
        <span className="font-semibold text-slate-700 dark:text-slate-100">Lubricating Oil total</span>
        <span className="tabular-nums text-lg font-bold text-sky-700 dark:text-sky-300">$ {money(total)}</span>
      </div>
      </fieldset>

      <WorksheetActions review={review} isAdmin={isAdmin} pending={pending}
        onSaveDraft={() => persist(false)} onSubmit={() => persist(true)} onReopen={reopen} onCancel={() => router.push(backHref)} />
    </div>
  );
}
