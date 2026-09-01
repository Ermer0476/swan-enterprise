import { Fragment } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, ListChecks, Lock, LockOpen } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/rbac";
import { OPEX_CATEGORIES } from "../../opex-controller/constants";
import { DEFAULT_PARTICULARS } from "../defaults";
import { orderByCanonical, CANONICAL_SUBITEMS } from "../../opex-controller/canonicalSubItems";
import OwnerFlowBar from "./OwnerFlowBar";
import ReviewBar from "./ReviewBar";
import BudgetPeriodBar from "./BudgetPeriodBar";

// Date -> "YYYY-MM" for <input type="month">
const toMonth = (d: Date | null | undefined) => (d ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}` : "");

export const dynamic = "force-dynamic";

const money = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
type SP = { [k: string]: string | string[] | undefined };

export default async function BuildProposalPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePermission("budget:read");
  const sp = await searchParams;
  const vesselId = typeof sp.vessel === "string" ? sp.vessel : "";
  const targetYear = typeof sp.year === "string" && /^\d{4}$/.test(sp.year) ? Number(sp.year) : new Date().getUTCFullYear() + 1;

  const vessel = vesselId ? await prisma.vessel.findFirst({ where: { id: vesselId, companyId: user.companyId }, select: { id: true, name: true } }) : null;

  if (!vessel) {
    const active = await prisma.vessel.findMany({ where: { companyId: user.companyId, deletedAt: null, status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true } });
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <PageHeader title="Budget Proposal Builder" description="Pick a vessel to start building next year's budget." />
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {active.map((v) => (
            <Link key={v.id} href={`/budget-proposal/build?vessel=${v.id}&year=${targetYear}`}
              className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm hover:border-sky-300 hover:bg-sky-50">
              {v.name}
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const rows = await prisma.budgetOpex.findMany({
    where: { companyId: user.companyId, vesselId: vessel.id },
    select: { monthYear: true, category: true, subCategory: true, subItem: true, budgetAllocated: true, actualCost: true, basis: true },
  });

  // Review status/note for this budget (the `__meta__` marker row).
  const metaRow = rows.find((r) => r.category === "__meta__" && r.monthYear === `PROP-${targetYear}`);
  const reviewNote = metaRow?.basis ?? null;

  // Budget period (months this budget covers). Saved value lives in the __meta__
  // row's subCategory as JSON; default to the schedule's contract period (the new
  // one when set), else the target-year calendar.
  const sched = await prisma.budgetSchedule.findFirst({ where: { companyId: user.companyId, vesselId: vessel.id }, orderBy: { syncedAt: "desc" }, select: { contractFrom: true, contractTo: true, nextContractFrom: true, nextContractTo: true } });
  let periodStart = "", periodEnd = "";
  if (metaRow?.subCategory) {
    try { const p = JSON.parse(metaRow.subCategory); periodStart = p.start ?? ""; periodEnd = p.end ?? ""; } catch { /* not JSON — ignore */ }
  }
  if (!periodStart) periodStart = toMonth(sched?.nextContractFrom) || toMonth(sched?.contractFrom) || `${targetYear}-01`;
  if (!periodEnd) periodEnd = toMonth(sched?.nextContractTo) || toMonth(sched?.contractTo) || `${targetYear}-12`;

  // Category totals + every particular, for both FY history (actuals) and the
  // stored proposal — so the summary lists all sub-categories (owner PDF view).
  const catHist: Record<string, Record<number, number>> = {};   // FY actuals
  const catHistBudget: Record<string, Record<number, number>> = {}; // FY budgets
  const catProposed: Record<string, number> = {};
  const subProposed: Record<string, Record<string, number>> = {};
  const subHist: Record<string, Record<string, Record<number, number>>> = {};
  const subHistBudget: Record<string, Record<string, Record<number, number>>> = {};
  const catNote: Record<string, Record<number, string>> = {}; // OPEX variance note per FY
  const yearsSet = new Set<number>();
  for (const r of rows) {
    if (r.category === "__meta__" || r.category === "__approved__" || r.category === "__report__") continue; // markers, not budget lines
    if (r.subItem != null) continue; // summary shows the group level, not 3rd-level sub-items
    if (r.monthYear === `PROP-${targetYear}`) {
      if (r.subCategory == null) catProposed[r.category] = r.budgetAllocated;
      else (subProposed[r.category] ??= {})[r.subCategory] = r.budgetAllocated;
      continue;
    }
    const m = r.monthYear.match(/^FY-(\d{4})$/);
    if (!m) continue;
    const y = Number(m[1]);
    yearsSet.add(y);
    if (r.subCategory == null) { (catHist[r.category] ??= {})[y] = r.actualCost; (catHistBudget[r.category] ??= {})[y] = r.budgetAllocated; if (r.basis?.trim()) (catNote[r.category] ??= {})[y] = r.basis.trim(); }
    else { ((subHist[r.category] ??= {})[r.subCategory] ??= {})[y] = r.actualCost; ((subHistBudget[r.category] ??= {})[r.subCategory] ??= {})[y] = r.budgetAllocated; }
  }
  const histYears = [...yearsSet].sort((a, b) => a - b).slice(-3);
  const lastHistYear = histYears[histYears.length - 1] ?? null; // most recent actual year
  const catNoteLast = (cat: string) => (lastHistYear != null ? catNote[cat]?.[lastHistYear] ?? null : null);

  // Particulars to list under a category: the proposed ones if a draft exists,
  // otherwise the historical ones (so the breakdown is visible either way).
  const particularsOf = (cat: string) => {
    const proposed = Object.keys(subProposed[cat] ?? {});
    if (proposed.length) return orderByCanonical(cat, proposed);
    const hist = Object.keys(subHist[cat] ?? {});
    if (hist.length) return orderByCanonical(cat, hist);
    return DEFAULT_PARTICULARS[cat] ?? CANONICAL_SUBITEMS[cat] ?? []; // standard template lines when not built/no history
  };

  // Per-category submit/lock status (from each category's `__status__` marker).
  const catStatus: Record<string, { submitted: boolean; lastEditor: string | null }> = {};
  for (const r of rows) {
    if (r.subItem === "__status__" && r.monthYear === `PROP-${targetYear}` && r.basis) {
      try { const d = JSON.parse(r.basis); catStatus[r.category] = { submitted: !!d.submitted, lastEditor: d.lastEditor ?? null }; } catch { /* skip */ }
    }
  }

  const grandProposed = OPEX_CATEGORIES.reduce((s, c) => s + (catProposed[c] ?? 0), 0);
  const histTotal = (y: number) => OPEX_CATEGORIES.reduce((s, c) => s + (catHist[c]?.[y] ?? 0), 0);
  const histTotalBudget = (y: number) => OPEX_CATEGORIES.reduce((s, c) => s + (catHistBudget[c]?.[y] ?? 0), 0);
  const filledCount = OPEX_CATEGORIES.filter((c) => catProposed[c] != null).length;

  // Owner-flow stage (the `__approved__` marker): null → not submitted; for_review
  // → sent to owners; approved → official. Plus whether every built category is
  // submitted (for the "complete proposal" hint).
  const approvedRow = rows.find((r) => r.category === "__approved__" && r.monthYear === `PROP-${targetYear}`);
  let owner = { stage: null as string | null, submittedBy: null as string | null, submittedAt: null as string | null, approvedBy: null as string | null, approvedAt: null as string | null };
  if (approvedRow?.basis) { try { const d = JSON.parse(approvedRow.basis); owner = { stage: d.stage ?? null, submittedBy: d.submittedBy ?? null, submittedAt: d.submittedAt ?? null, approvedBy: d.approvedBy ?? null, approvedAt: d.approvedAt ?? null }; } catch { /* ignore */ } }
  const builtCats = OPEX_CATEGORIES.filter((c) => catProposed[c] != null);
  const allSubmitted = builtCats.length > 0 && builtCats.every((c) => catStatus[c]?.submitted);
  // Review status is derived, not manually chosen: all categories completed →
  // "For Review", otherwise "Drafting".
  const derivedStatus = allSubmitted ? "For Review" : "Drafting";

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <Link href="/budget-proposal" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Back to schedule
      </Link>
      <PageHeader title={`Budget Proposal · ${vessel.name}`} description={`FY ${targetYear} — open each category to edit its particulars; the proposed total fills in here automatically.`} />

      <p className="mb-3 text-xs font-medium text-slate-500">{filledCount} of {OPEX_CATEGORIES.length} categories drafted</p>

      <BudgetPeriodBar vesselId={vessel.id} year={targetYear} start={periodStart} end={periodEnd} />

      <ReviewBar vesselId={vessel.id} year={targetYear} status={derivedStatus} note={reviewNote} />

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400 dark:border-slate-700 dark:bg-slate-800">
            <tr>
              <th className="px-4 py-3 font-semibold">Category</th>
              {histYears.map((y) => (
                <Fragment key={y}>
                  <th className="px-4 py-3 text-right font-semibold">FY {y} budget</th>
                  <th className="px-4 py-3 text-right font-semibold">FY {y} actual</th>
                </Fragment>
              ))}
              <th className="px-4 py-3 text-right font-semibold text-sky-700 dark:text-sky-300">Proposed FY {targetYear}</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {OPEX_CATEGORIES.map((cat) => {
              const prop = catProposed[cat];
              const editHref = `/budget-proposal/build/category?vessel=${vessel.id}&year=${targetYear}&cat=${encodeURIComponent(cat)}`;
              const subs = particularsOf(cat);
              return (
                <Fragment key={cat}>
                  {/* Category header */}
                  <tr className="group bg-slate-50/60 hover:bg-sky-50/60 dark:bg-slate-800/40 dark:hover:bg-slate-800/70">
                    <td className="px-4 py-2.5">
                      <Link href={editHref} className="font-semibold text-slate-800 group-hover:text-sky-700 dark:text-slate-100">{cat}</Link>
                      {(() => {
                        const s = catStatus[cat];
                        if (s?.submitted) return <span title={s.lastEditor ? `Last updated by ${s.lastEditor}` : undefined} className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"><Lock className="h-3 w-3" />Submitted{s.lastEditor ? ` · ${s.lastEditor}` : ""}</span>;
                        if (prop != null) return <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"><LockOpen className="h-3 w-3" />Open</span>;
                        return null;
                      })()}
                      {catNoteLast(cat) && (
                        <p className="mt-1 max-w-md whitespace-pre-wrap text-[11px] italic text-slate-400 dark:text-slate-500">📝 FY {lastHistYear}: {catNoteLast(cat)}</p>
                      )}
                    </td>
                    {histYears.map((y) => (
                      <Fragment key={y}>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-500 dark:text-slate-400">
                          {catHistBudget[cat]?.[y] != null ? money(catHistBudget[cat][y]) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">
                          {catHist[cat]?.[y] != null ? money(catHist[cat][y]) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                        </td>
                      </Fragment>
                    ))}
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-sky-700 dark:text-sky-300">
                      {prop != null ? money(prop) : <span className="font-normal text-slate-300 dark:text-slate-600">not set</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Link href={editHref} className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-slate-400 group-hover:text-sky-600">
                        <ListChecks className="h-3.5 w-3.5" /> Edit <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                  {/* Particulars breakdown */}
                  {subs.map((sub) => (
                    <tr key={`${cat}|${sub}`} className="text-slate-500 dark:text-slate-400">
                      <td className="py-1.5 pl-8 pr-4">{sub}</td>
                      {histYears.map((y) => (
                        <Fragment key={y}>
                          <td className="px-4 py-1.5 text-right tabular-nums text-slate-400">
                            {subHistBudget[cat]?.[sub]?.[y] != null ? money(subHistBudget[cat][sub][y]) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                          </td>
                          <td className="px-4 py-1.5 text-right tabular-nums text-slate-400">
                            {subHist[cat]?.[sub]?.[y] != null ? money(subHist[cat][sub][y]) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                          </td>
                        </Fragment>
                      ))}
                      <td className="px-4 py-1.5 text-right tabular-nums text-slate-600 dark:text-slate-300">
                        {subProposed[cat]?.[sub] != null ? money(subProposed[cat][sub]) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                      <td />
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-semibold dark:border-slate-700 dark:bg-slate-800">
            <tr>
              <td className="px-4 py-3 text-slate-700 dark:text-slate-100">Total Operating Cost</td>
              {histYears.map((y) => (
                <Fragment key={y}>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-500 dark:text-slate-400">{money(histTotalBudget(y))}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">{money(histTotal(y))}</td>
                </Fragment>
              ))}
              <td className="px-4 py-3 text-right tabular-nums text-sky-700 dark:text-sky-300">{money(grandProposed)}</td>
              <td />
            </tr>
            <tr className="text-[13px] font-normal">
              <td className="px-4 py-1.5 text-slate-500 dark:text-slate-400">Cost per Day (365 days)</td>
              {histYears.map((y) => (
                <Fragment key={y}>
                  <td className="px-4 py-1.5 text-right tabular-nums text-slate-500 dark:text-slate-400">{money(histTotalBudget(y) / 365)}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums text-slate-500 dark:text-slate-400">{money(histTotal(y) / 365)}</td>
                </Fragment>
              ))}
              <td className="px-4 py-1.5 text-right tabular-nums text-sky-600 dark:text-sky-400">{money(grandProposed / 365)}</td>
              <td />
            </tr>
            <tr className="text-[13px] font-normal">
              <td className="px-4 py-1.5 pb-3 text-slate-500 dark:text-slate-400">Total Monthly Operating Budget</td>
              {histYears.map((y) => (
                <Fragment key={y}>
                  <td className="px-4 py-1.5 pb-3 text-right tabular-nums text-slate-500 dark:text-slate-400">{money(histTotalBudget(y) / 12)}</td>
                  <td className="px-4 py-1.5 pb-3 text-right tabular-nums text-slate-500 dark:text-slate-400">{money(histTotal(y) / 12)}</td>
                </Fragment>
              ))}
              <td className="px-4 py-1.5 pb-3 text-right tabular-nums text-sky-600 dark:text-sky-400">{money(grandProposed / 12)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <OwnerFlowBar vesselId={vessel.id} vesselName={vessel.name} year={targetYear} owner={owner} hasBudget={grandProposed > 0} allSubmitted={allSubmitted}
        reportHref={`/budget-proposal/approved/report?vessel=${vessel.id}&year=${targetYear}`} />
    </div>
  );
}
