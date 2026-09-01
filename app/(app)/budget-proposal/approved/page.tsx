import Link from "next/link";
import { ArrowLeft, Archive, ChevronRight, CheckCircle2, Send } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const money = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtMonth = (m: string | null) => { const x = m && /^(\d{4})-(\d{2})$/.exec(m); return x ? `${MONTHS[Number(x[2]) - 1]} ${x[1]}` : ""; };
const fmtDate = (iso: string | null) => { if (!iso) return ""; const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }); };

type Item = { vesselId: string; vesselName: string; year: number; total: number; stage: string; actor: string | null; at: string | null; periodStart: string | null; periodEnd: string | null };

export default async function ApprovedBudgetsPage() {
  const user = await requirePermission("budget:read");
  const markers = await prisma.budgetOpex.findMany({ where: { companyId: user.companyId, category: "__approved__" }, select: { vesselId: true, monthYear: true, basis: true } });
  const vessels = await prisma.vessel.findMany({ where: { companyId: user.companyId }, select: { id: true, name: true } });
  const nameOf = new Map(vessels.map((v) => [v.id, v.name]));

  const items: Item[] = [];
  for (const m of markers) {
    const yr = /^PROP-(\d{4})$/.exec(m.monthYear);
    if (!yr) continue;
    let d: { stage?: string; approvedBy?: string; approvedAt?: string; submittedBy?: string; submittedAt?: string; total?: number; periodStart?: string; periodEnd?: string } = {};
    try { d = m.basis ? JSON.parse(m.basis) : {}; } catch { /* ignore */ }
    const stage = d.stage === "approved" ? "approved" : "for_review";
    items.push({
      vesselId: m.vesselId, vesselName: nameOf.get(m.vesselId) ?? "Unknown vessel", year: Number(yr[1]),
      total: d.total ?? 0, stage,
      actor: stage === "approved" ? d.approvedBy ?? null : d.submittedBy ?? null,
      at: stage === "approved" ? d.approvedAt ?? null : d.submittedAt ?? null,
      periodStart: d.periodStart ?? null, periodEnd: d.periodEnd ?? null,
    });
  }

  // Group by vessel (alphabetical); within a vessel, list its approved years
  // newest first — one vessel's budget history at a glance, year after year.
  const byVessel = new Map<string, Item[]>();
  for (const it of items) { (byVessel.get(it.vesselId) ?? byVessel.set(it.vesselId, []).get(it.vesselId)!).push(it); }
  const vesselIds = [...byVessel.keys()].sort((a, b) => (nameOf.get(a) ?? "").localeCompare(nameOf.get(b) ?? ""));
  for (const id of vesselIds) byVessel.get(id)!.sort((a, b) => b.year - a.year);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Link href="/budget-proposal" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Back to schedule
      </Link>
      <PageHeader title="Owner Budgets" description="Repository per vessel — budgets sent to owners for review and those approved by owners, year after year." />

      {vesselIds.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white/50 px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900/40">
          <Archive className="h-8 w-8 text-slate-300" />
          <p className="text-sm font-medium text-slate-500">Nothing here yet</p>
          <p className="max-w-sm text-xs text-slate-400">Build a proposal, then hit “Submit to owners”. It lands here as “For review by owners”, then “Approved by owners” once they sign off.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          {vesselIds.map((id) => {
            const list = byVessel.get(id)!;
            return (
              <section key={id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-baseline justify-between border-b border-slate-100 bg-slate-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-800/50">
                  <h2 className="font-bold text-slate-800 dark:text-slate-100">{nameOf.get(id) ?? "Unknown vessel"}</h2>
                  <span className="text-xs text-slate-400">{list.length} budget{list.length === 1 ? "" : "s"}</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {list.map((it) => {
                    const approved = it.stage === "approved";
                    return (
                      <Link key={it.year} href={`/budget-proposal/approved/view?vessel=${it.vesselId}&year=${it.year}`}
                        className="group flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        {approved ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" /> : <Send className="h-5 w-5 shrink-0 text-violet-500" />}
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">FY {it.year}
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${approved ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"}`}>{approved ? "Approved by owners" : "For review by owners"}</span>
                          </p>
                          <p className="text-xs text-slate-400">
                            {it.periodStart && it.periodEnd ? <>{fmtMonth(it.periodStart)} – {fmtMonth(it.periodEnd)} · </> : null}
                            {it.actor ? <>{approved ? "approved" : "sent"} by {it.actor}</> : approved ? "approved" : "sent"}{it.at ? ` · ${fmtDate(it.at)}` : ""}
                          </p>
                        </div>
                        <span className="shrink-0 tabular-nums text-sm font-bold text-slate-700 dark:text-slate-200">$ {money(it.total)}</span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-slate-500" />
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
