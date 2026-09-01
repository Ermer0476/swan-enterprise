import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, CalendarRange, FileText, Send } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/rbac";
import { OPEX_CATEGORIES } from "../../../opex-controller/constants";
import { orderByCanonical } from "../../../opex-controller/canonicalSubItems";

export const dynamic = "force-dynamic";

const money = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtMonth = (m: string | null) => { const x = m && /^(\d{4})-(\d{2})$/.exec(m); return x ? `${MONTHS[Number(x[2]) - 1]} ${x[1]}` : ""; };
const fmtDate = (iso: string | null) => { if (!iso) return ""; const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }); };

type SP = { [k: string]: string | string[] | undefined };

export default async function ApprovedBudgetView({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePermission("budget:read");
  const sp = await searchParams;
  const vesselId = typeof sp.vessel === "string" ? sp.vessel : "";
  const year = typeof sp.year === "string" && /^\d{4}$/.test(sp.year) ? Number(sp.year) : 0;

  const vessel = vesselId ? await prisma.vessel.findFirst({ where: { id: vesselId, companyId: user.companyId }, select: { id: true, name: true } }) : null;
  const marker = year ? await prisma.budgetOpex.findFirst({ where: { companyId: user.companyId, vesselId, monthYear: `PROP-${year}`, category: "__approved__" }, select: { basis: true } }) : null;
  if (!vessel || !year || !marker) notFound();

  let mk: { stage?: string; approvedBy?: string; approvedAt?: string; submittedBy?: string; submittedAt?: string; periodStart?: string; periodEnd?: string } = {};
  try { mk = marker.basis ? JSON.parse(marker.basis) : {}; } catch { /* ignore */ }
  const isApproved = mk.stage === "approved";
  const meta = { periodStart: mk.periodStart, periodEnd: mk.periodEnd, actor: isApproved ? mk.approvedBy : mk.submittedBy, at: isApproved ? mk.approvedAt : mk.submittedAt };

  // Figures live in PROP-<year> (the working draft). Read the category totals +
  // particulars (group level); 3rd-level rows roll into groups.
  const rows = await prisma.budgetOpex.findMany({
    where: { companyId: user.companyId, vesselId, monthYear: `PROP-${year}`, subItem: null },
    select: { category: true, subCategory: true, budgetAllocated: true },
  });
  const catTotal: Record<string, number> = {};
  const subs: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    if (r.category.startsWith("__")) continue;
    if (r.subCategory == null) catTotal[r.category] = r.budgetAllocated;
    else (subs[r.category] ??= {})[r.subCategory] = r.budgetAllocated;
  }
  const grand = OPEX_CATEGORIES.reduce((s, c) => s + (catTotal[c] ?? 0), 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Link href="/budget-proposal/approved" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Back to approved budgets
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title={`${vessel.name} · FY ${year} budget`} description={isApproved ? "Approved by owners — official budget." : "Sent to owners for review — pending approval."} />
        <Link href={`/budget-proposal/approved/report?vessel=${vessel.id}&year=${year}`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700">
          <FileText className="h-4 w-4" /> Owner report (PDF)
        </Link>
      </div>

      <div className={`mb-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border px-4 py-3 text-sm ${isApproved ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/25" : "border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-900/25"}`}>
        {isApproved
          ? <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" /> Approved by owners</span>
          : <span className="inline-flex items-center gap-1.5 font-semibold text-violet-700 dark:text-violet-300"><Send className="h-4 w-4" /> For review by owners</span>}
        {meta.periodStart && meta.periodEnd && (
          <span className={`inline-flex items-center gap-1.5 ${isApproved ? "text-emerald-800 dark:text-emerald-200" : "text-violet-800 dark:text-violet-200"}`}><CalendarRange className="h-4 w-4" /> {fmtMonth(meta.periodStart)} – {fmtMonth(meta.periodEnd)}</span>
        )}
        {meta.actor && <span className={isApproved ? "text-emerald-700/80 dark:text-emerald-300/80" : "text-violet-700/80 dark:text-violet-300/80"}>{isApproved ? "by" : "sent by"} {meta.actor}</span>}
        {meta.at && <span className={isApproved ? "text-emerald-700/80 dark:text-emerald-300/80" : "text-violet-700/80 dark:text-violet-300/80"}>· {fmtDate(meta.at)}</span>}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400 dark:border-slate-700 dark:bg-slate-800">
            <tr>
              <th className="px-4 py-3 font-semibold">Category / particular</th>
              <th className="px-4 py-3 text-right font-semibold">{isApproved ? "Approved" : "Proposed"} FY {year}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {OPEX_CATEGORIES.map((cat) => {
              const parts = orderByCanonical(cat, Object.keys(subs[cat] ?? {}));
              return (
                <Fragment key={cat}>
                  <tr className="bg-slate-50/60 dark:bg-slate-800/40">
                    <td className="px-4 py-2.5 font-semibold text-slate-800 dark:text-slate-100">{cat}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-slate-800 dark:text-slate-100">
                      {catTotal[cat] != null ? money(catTotal[cat]) : <span className="font-normal text-slate-300 dark:text-slate-600">—</span>}
                    </td>
                  </tr>
                  {parts.map((sub) => (
                    <tr key={`${cat}|${sub}`} className="text-slate-500 dark:text-slate-400">
                      <td className="py-1.5 pl-8 pr-4">{sub}</td>
                      <td className="px-4 py-1.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{money(subs[cat]?.[sub] ?? 0)}</td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-semibold dark:border-slate-700 dark:bg-slate-800">
            <tr>
              <td className="px-4 py-3 text-slate-700 dark:text-slate-100">Grand Total</td>
              <td className="px-4 py-3 text-right tabular-nums text-emerald-700 dark:text-emerald-300">$ {money(grand)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
