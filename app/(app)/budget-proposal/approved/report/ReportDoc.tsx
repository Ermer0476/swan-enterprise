"use client";

import { Fragment, useState, useTransition } from "react";
import Link from "next/link";
import { Printer, Check, Pencil, ArrowLeft } from "lucide-react";
import { saveReportFields } from "../../actions";

type VesselInfo = {
  name: string; type: string | null; capacityCbm: number | null; grt: number | null;
  flag: string | null; vesselClass: string | null; yearBuilt: number | null; yearWithSwan: number | null;
  tradeArea: string | null; owner: string | null;
};
type Particular = { name: string; code: string; amount: number; note: string | null; days: number | null; qty: number | null; rate: number | null; rob: number | null };
type RmItem = { name: string; amount: number; expiry: string | null; note: string | null };
type Section = { key: string; letter: string; title: string; lines: Particular[]; subtotal: number; rmItems: Record<string, RmItem[]> | null };
type Monthly = { crewing: number; opex: number; mgmt: number; total: number };
type Crewing = { nationality: string; itf: string; manning: { count: number; position: string }[]; notes: string } | null;
type Props = {
  vesselId: string; year: number; vessel: VesselInfo;
  period: { start: string | null; end: string | null };
  stage: string;
  fields: Record<string, string>;
  crewing: Crewing;
  sections: Section[]; mgmtFee: number; mgmtLetter: string; total: number; costPerDay: number; monthly: Monthly;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const money = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const money2 = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtMonth = (m: string | null) => { const x = m && /^(\d{4})-(\d{2})$/.exec(m); return x ? `${MONTHS[Number(x[2]) - 1]} ${x[1]}` : ""; };
const monthsBetween = (a: string | null, b: string | null) => {
  const x = a && /^(\d{4})-(\d{2})$/.exec(a), y = b && /^(\d{4})-(\d{2})$/.exec(b);
  if (!x || !y) return 0;
  return (Number(y[1]) - Number(x[1])) * 12 + (Number(y[2]) - Number(x[2])) + 1;
};
const ordinal = (n: number) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] ?? s[v] ?? s[0] ?? "th"); };
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDMY = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : `${String(d.getUTCDate()).padStart(2, "0")}-${MONTHS[d.getUTCMonth()]}-${String(d.getUTCFullYear()).slice(2)}`; };

// Module-scope so inputs keep focus across the parent's re-renders.
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 py-[3px] text-[13px]">
      <span className="w-40 shrink-0 font-semibold text-slate-500">{label}</span>
      <span className="text-slate-900">{children}</span>
    </div>
  );
}

function EditField({ value, onChange, onCommit, placeholder, width = "auto" }: { value: string; onChange: (v: string) => void; onCommit: (v: string) => void; placeholder?: string; width?: string }) {
  return (
    <input value={value} onChange={(e) => onChange(e.target.value)} onBlur={(e) => onCommit(e.target.value)} placeholder={placeholder}
      style={{ width }} className="report-input border-b border-dashed border-slate-300 bg-transparent px-0.5 text-slate-900 focus:border-sky-500 focus:outline-none" />
  );
}

export default function ReportDoc({ vesselId, year, vessel, period, stage, fields, crewing, sections, mgmtFee, mgmtLetter, total, costPerDay, monthly }: Props) {
  const [f, setF] = useState<Record<string, string>>({ date: fields.date || todayISO(), revision: fields.revision || "0", ...fields });
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const save = (next: Record<string, string>) => start(async () => { await saveReportFields(vesselId, year, next); setSaved(true); setTimeout(() => setSaved(false), 1500); });
  const onField = (k: string, v: string) => setF((prev) => ({ ...prev, [k]: v }));
  const commit = (k: string, v: string) => { const next = { ...f, [k]: v }; setF(next); save(next); };
  const edit = (k: string, placeholder?: string, width?: string) => (
    <EditField value={f[k] ?? ""} onChange={(v) => onField(k, v)} onCommit={(v) => commit(k, v)} placeholder={placeholder} width={width} />
  );

  const startY = period.start ? Number(period.start.slice(0, 4)) : year;
  const dur = monthsBetween(period.start, period.end);
  const periodLabel = period.start && period.end
    ? `${dur === 12 ? "One Year" : `${dur} Months`} (${fmtMonth(period.start)} - ${fmtMonth(period.end)})`
    : "—";
  const yearsAtSwan = vessel.yearWithSwan ? `${vessel.yearWithSwan}  ·  ${ordinal(Math.max(1, startY - vessel.yearWithSwan))} year` : "—";

  // Lube calc one-liner from stored fields, when present.
  const lubeCalc = (p: Particular) => {
    const bits: string[] = [];
    if (p.qty && p.days && p.rate) bits.push(`${money(p.qty)} Ltrs/day × $${p.rate} × ${money(p.days)} days`);
    if (p.rob) bits.push(`ROB ${money(p.rob)} ltrs`);
    return bits.join("  ·  ");
  };

  return (
    <div className="bg-slate-100 py-6 dark:bg-slate-950">
      <style>{`
        @media print {
          body { background: #fff !important; }
          body * { visibility: hidden !important; }
          #owner-report, #owner-report * { visibility: visible !important; }
          #owner-report { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; }
          .no-print { display: none !important; }
          .report-input { border: none !important; }
          .report-input::placeholder { color: transparent !important; }
          .page-break { break-before: page; }
          @page { size: A4 portrait; margin: 14mm; }
        }
      `}</style>

      {/* Back link (screen only) */}
      <div className="no-print mx-auto mb-3 max-w-[820px] px-4">
        <Link href={`/budget-proposal/approved/view?vessel=${vesselId}&year=${year}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
          <ArrowLeft className="h-4 w-4" /> Back to owner budget
        </Link>
      </div>

      {/* Toolbar (screen only) */}
      <div className="no-print mx-auto mb-4 flex max-w-[820px] items-center justify-between px-4">
        <p className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"><Pencil className="h-3.5 w-3.5" /> Dashed-underline fields are editable — they save automatically and carry to next year.</p>
        <div className="flex items-center gap-3">
          {pending && <span className="text-xs text-slate-400">saving…</span>}
          {saved && !pending && <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><Check className="h-3.5 w-3.5" /> saved</span>}
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700">
            <Printer className="h-4 w-4" /> Print / Save as PDF
          </button>
        </div>
      </div>

      {/* The printable document */}
      <div id="owner-report" className="mx-auto max-w-[820px] bg-white px-12 py-12 text-slate-900 shadow-sm">
        {/* ---- Page 1: Cover ---- */}
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-wide">Budget Proposal</h1>
          <div className="mx-auto mt-1 h-0.5 w-24 bg-slate-800" />
          <p className={`mt-2 text-xs font-semibold uppercase tracking-widest ${stage === "approved" ? "text-emerald-600" : "text-slate-400"}`}>
            {stage === "approved" ? "Approved by owners" : "For review by owners"}
          </p>
        </div>

        <div className="mx-auto mt-8 max-w-[560px]">
          <div className="mb-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Vessel</p>
            <p className="text-xl font-bold uppercase">{vessel.name}</p>
          </div>

          <Row label="IMO No.">{edit("imo", "e.g. 9959840", "140px")}</Row>
          <Row label="Type">{vessel.type ?? "—"}</Row>
          <Row label="Capacity">{vessel.capacityCbm != null ? `${money(vessel.capacityCbm)} CBM` : "—"}</Row>
          <Row label="Main Engine">{edit("mainEngine", "e.g. HITACHI B&W 6S35ME-B9.7 — 3,700 kW", "340px")}</Row>
          <Row label="Year at Swan">{yearsAtSwan}</Row>
          <Row label="GRT">{vessel.grt != null ? money(vessel.grt) : "—"}</Row>
          <Row label="Flag">{vessel.flag ?? "—"}</Row>
          <Row label="Class">{vessel.vesselClass ?? "—"}</Row>
          <Row label="Built">{vessel.yearBuilt ?? "—"}</Row>
          <Row label="Trading Area">{vessel.tradeArea ?? "—"}</Row>
          <Row label="Crew">{edit("crew", "e.g. 18", "60px")}</Row>
          <Row label="ITF">{edit("itf", "e.g. No Union Dues", "220px")}</Row>
          <Row label="Period">{periodLabel}</Row>
          <Row label="Budget Issued to">{edit("issuedTo", "—", "260px")}</Row>
          <Row label="Date">{edit("date", undefined, "150px")} <span className="ml-2 text-xs text-slate-400">({f.date ? fmtDMY(f.date) : ""})</span></Row>
          <Row label="Revision">{edit("revision", "0", "50px")}</Row>
        </div>

        <div className="mt-10 flex items-end justify-between text-[13px]">
          <div>
            <p className="font-semibold text-slate-500">Prepared by</p>
            <p className="font-bold">Swan Shipping Corp.</p>
            <p className="text-slate-600">Manila, Philippines</p>
          </div>
          <div className="text-right">
            <p className="font-semibold text-slate-500">Owner</p>
            <p className="max-w-[280px] font-medium">{vessel.owner ?? "—"}</p>
          </div>
        </div>

        {/* ---- Page 2: Summary budget ---- */}
        <div className="page-break pt-2">
          <div className="mb-3 flex items-baseline justify-between border-b-2 border-slate-800 pb-1">
            <span className="font-bold">SWAN Shipping Corp.</span>
            <span className="text-xs text-slate-500">Amount in US$</span>
          </div>
          <p className="mb-3 font-bold uppercase">{vessel.name} <span className="font-normal text-slate-500">· {periodLabel}</span></p>

          <table className="w-full border-collapse text-[12.5px]">
            <tbody>
              {sections.map((sec) => (
                <Fragment key={sec.key}>
                  <tr><td colSpan={3} className="pt-3 pb-1 font-bold text-slate-800">{sec.letter}. {sec.title}</td></tr>
                  {sec.lines.map((l) => (
                    <tr key={l.name} className="border-b border-slate-100">
                      <td className="w-14 py-1 pl-3 align-top tabular-nums text-slate-400">{l.code}</td>
                      <td className="py-1 pr-3 text-slate-700">{l.name}</td>
                      <td className="w-32 py-1 text-right tabular-nums text-slate-700">{money(l.amount)}</td>
                    </tr>
                  ))}
                  <tr className="border-y border-slate-300">
                    <td />
                    <td className="py-1 font-semibold text-slate-800">Sub-total {sec.letter}</td>
                    <td className="py-1 text-right font-semibold tabular-nums text-slate-800">{money(sec.subtotal)}</td>
                  </tr>
                </Fragment>
              ))}
              <tr className="border-b border-slate-200">
                <td />
                <td className="py-2 pt-3 font-bold text-slate-800">Management Fee</td>
                <td className="py-2 pt-3 text-right font-bold tabular-nums text-slate-800">{money(mgmtFee)}</td>
              </tr>
              <tr className="border-y-2 border-slate-800">
                <td />
                <td className="py-2 text-[14px] font-bold">TOTAL OPERATING COSTS</td>
                <td className="py-2 text-right text-[14px] font-bold tabular-nums">{money(total)}</td>
              </tr>
              <tr>
                <td />
                <td className="py-1 text-slate-500">Cost per Day (365 days)</td>
                <td className="py-1 text-right tabular-nums text-slate-600">{money(costPerDay)}</td>
              </tr>
            </tbody>
          </table>

          {/* Monthly billing split */}
          <div className="mt-8">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Monthly Billing — {periodLabel.replace(/^.*\(/, "").replace(/\)$/, "")}</p>
            <table className="w-full border-collapse text-[12.5px]">
              <tbody>
                <tr className="border-b border-slate-100"><td className="py-1 text-slate-700">Monthly Crewing Fee</td><td className="w-32 py-1 text-right tabular-nums text-slate-700">{money(monthly.crewing)}</td></tr>
                <tr className="border-b border-slate-100"><td className="py-1 text-slate-700">Opex</td><td className="py-1 text-right tabular-nums text-slate-700">{money(monthly.opex)}</td></tr>
                <tr className="border-b border-slate-100"><td className="py-1 text-slate-700">Management Fee</td><td className="py-1 text-right tabular-nums text-slate-700">{money(monthly.mgmt)}</td></tr>
                <tr className="border-y border-slate-400"><td className="py-1 font-bold text-slate-800">Total Monthly Operating Budget</td><td className="py-1 text-right font-bold tabular-nums text-slate-800">{money(monthly.total)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ---- Pages 3–4: Particulars (basis of each figure) ---- */}
        <div className="page-break pt-2">
          <div className="mb-3 flex items-baseline justify-between border-b-2 border-slate-800 pb-1">
            <span className="font-bold">SWAN Shipping Corp.</span>
            <span className="text-xs text-slate-500">Particulars — basis of the budget</span>
          </div>

          <div className="space-y-5">
            {sections.map((sec) => (
              <div key={sec.key} className="break-inside-avoid">
                {sec.key === "Crewing" && crewing ? (
                  <>
                    <h3 className="mb-2 font-bold text-slate-800">
                      {sec.letter}. {sec.title}{crewing.nationality ? ` - ${crewing.nationality}` : ""}
                      <span className="ml-3 underline">{crewing.manning.reduce((s, m) => s + (Number(m.count) || 0), 0)}</span>
                      {crewing.itf ? <span className="ml-3 font-semibold">{crewing.itf}</span> : null}
                    </h3>
                    {crewing.manning.length > 0 && (
                      <div className="mb-2 columns-2 gap-8 pl-3 text-[12px] text-slate-700 [column-fill:balance]">
                        {crewing.manning.map((m, i) => (
                          <div key={i} className="flex gap-3 break-inside-avoid py-[1px]"><span className="w-5 shrink-0 tabular-nums">{m.count}</span><span>{m.position}</span></div>
                        ))}
                      </div>
                    )}
                    {crewing.notes && <p className="whitespace-pre-wrap pl-3 text-[12px] leading-snug text-slate-600">{crewing.notes}</p>}
                  </>
                ) : (
                  <h3 className="mb-1 font-bold text-slate-800">{sec.letter}. {sec.title}</h3>
                )}
                <div className="space-y-1.5">
                  {sec.lines.map((l) => {
                    const calc = sec.key === "Lubricating Oil" ? lubeCalc(l) : "";
                    const rm = sec.rmItems?.[l.name] ?? [];
                    if (!l.note && !calc && rm.length === 0) return null;
                    return (
                      <div key={l.name} className="text-[12px] leading-snug">
                        <span className="font-semibold text-slate-700">{l.name}</span>
                        <span className="tabular-nums text-slate-400"> — {money(l.amount)}</span>
                        {calc && <span className="text-slate-500"> · {calc}</span>}
                        {l.note && <p className="whitespace-pre-wrap pl-3 text-slate-600">{l.note}</p>}
                        {rm.length > 0 && (
                          <ul className="mt-0.5 space-y-0.5 pl-3">
                            {rm.map((it) => (
                              <li key={it.name} className="flex justify-between gap-3 text-slate-600">
                                <span>{it.name}{it.expiry ? <span className="text-slate-400"> · Expire: {it.expiry}</span> : null}{it.note ? <span className="text-slate-400"> — {it.note}</span> : null}</span>
                                <span className="shrink-0 tabular-nums">{money(it.amount)}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {mgmtFee > 0 && (
              <div className="break-inside-avoid text-[12px]">
                <h3 className="mb-1 font-bold text-slate-800">{mgmtLetter}. Management Fees</h3>
                <p className="pl-3 text-slate-600">{money2(mgmtFee)} for the budget period.</p>
              </div>
            )}
          </div>

          <p className="mt-8 text-[11px] text-slate-400">Prepared by Swan Shipping Corp., Manila — for owner review. Figures in US$.</p>
        </div>
      </div>
    </div>
  );
}
