import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission, can } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { OPEX_CATEGORIES } from "../../../opex-controller/constants";
import { DEFAULT_PARTICULARS } from "../../defaults";
import { orderByCanonical, CANONICAL_SUBITEMS } from "../../../opex-controller/canonicalSubItems";
import CategoryEditor from "./CategoryEditor";
import LubeOilWorksheet from "./LubeOilWorksheet";
import RepairsWorksheet from "./RepairsWorksheet";
import NotesWorksheet from "./NotesWorksheet";
import ManagementFeeWorksheet from "./ManagementFeeWorksheet";

export const dynamic = "force-dynamic";

type SP = { [k: string]: string | string[] | undefined };

export default async function CategoryDetailPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePermission("budget:read");
  const isManager = can(user, "budget:manage");
  const sp = await searchParams;
  const vesselId = typeof sp.vessel === "string" ? sp.vessel : "";
  const cat = typeof sp.cat === "string" ? sp.cat : "";
  const targetYear = typeof sp.year === "string" && /^\d{4}$/.test(sp.year) ? Number(sp.year) : new Date().getUTCFullYear() + 1;

  const vessel = vesselId ? await prisma.vessel.findFirst({ where: { id: vesselId, companyId: user.companyId }, select: { id: true, name: true } }) : null;
  if (!vessel || !OPEX_CATEGORIES.includes(cat as (typeof OPEX_CATEGORIES)[number])) notFound();

  const rows = await prisma.budgetOpex.findMany({
    where: { companyId: user.companyId, vesselId: vessel.id, category: cat },
    select: { monthYear: true, subCategory: true, subItem: true, budgetAllocated: true, actualCost: true, days: true, qty: true, rate: true, rob: true, orderQty: true, expiry: true, basis: true },
  });

  // Grouped (3-level) proposal data for the R&M worksheet, per period, so we can
  // carry the previous year's detail (esp. expiry dates) into a fresh proposal.
  type RmGroupData = { amount: number; items: { name: string; amount: number; expiry: string | null; note: string | null }[] };
  const rmByPeriod: Record<string, Record<string, RmGroupData>> = {};
  for (const r of rows) {
    if (!r.subCategory) continue;
    const period = (rmByPeriod[r.monthYear] ??= {});
    const grp = (period[r.subCategory] ??= { amount: 0, items: [] });
    if (r.subItem == null) grp.amount = r.budgetAllocated;
    else grp.items.push({ name: r.subItem, amount: r.budgetAllocated, expiry: r.expiry, note: r.basis });
  }
  const yearOfPeriod = (per: string) => { const m = per.match(/^(?:FY|PROP)-(\d{4})$/); return m && m[1] ? Number(m[1]) : null; };
  const hasItems = (g: Record<string, RmGroupData>) => Object.values(g).some((x) => x.items.length);
  let rmSaved: Record<string, RmGroupData> = rmByPeriod[`PROP-${targetYear}`] ?? {};
  let rmCarriedFrom: number | null = null;
  if (!hasItems(rmSaved)) {
    // No draft yet for this year — carry the most recent prior period's detail.
    const prior = Object.keys(rmByPeriod)
      .map((per) => ({ per, y: yearOfPeriod(per), g: rmByPeriod[per] }))
      .filter((x) => x.y != null && x.y < targetYear && x.g != null && hasItems(x.g))
      .sort((a, b) => (b.y as number) - (a.y as number))[0];
    if (prior && prior.g) { rmSaved = prior.g; rmCarriedFrom = prior.y; }
  }

  // history[sub][year] = { budget, actual }; sub "" is the category-level line.
  const history: Record<string, Record<number, { budget: number; actual: number }>> = {};
  const proposed: Record<string, { amount: number; days: number | null; qty: number | null; rate: number | null; rob: number | null; orderQty: number | null; basis: string | null }> = {};
  const yearsSet = new Set<number>();
  const partsSet = new Set<string>();
  for (const r of rows) {
    if (r.subItem != null) continue; // 3rd-level rows are handled by rmSaved
    const sub = r.subCategory ?? "";
    if (r.monthYear === `PROP-${targetYear}`) {
      proposed[sub] = { amount: r.budgetAllocated, days: r.days, qty: r.qty, rate: r.rate, rob: r.rob, orderQty: r.orderQty, basis: r.basis };
      continue;
    }
    const m = r.monthYear.match(/^FY-(\d{4})$/);
    if (!m) continue;
    const y = Number(m[1]);
    yearsSet.add(y);
    (history[sub] ??= {})[y] = { budget: r.budgetAllocated, actual: r.actualCost };
    if (sub) partsSet.add(sub);
  }
  const histYears = [...yearsSet].sort((a, b) => a - b).slice(-3);
  // Historical particulars (ordered to match the Excel; extras like Bank Charges
  // fall to the bottom), or the Excel-template defaults when none exist yet.
  const particulars = partsSet.size
    ? orderByCanonical(cat, [...partsSet])
    : (DEFAULT_PARTICULARS[cat] ?? CANONICAL_SUBITEMS[cat] ?? []);

  // Last year's actual per particular (and per R&M group) — shown as a reference
  // while editing so the user has a basis for the proposed figure.
  const lastActualYear = histYears[histYears.length - 1] ?? null;
  // Last year's OPEX variance note (why over/under budget) — shown as reference
  // while building this category, so there's no need to open the OPEX Controller.
  const lastNote = lastActualYear != null
    ? rows.find((r) => r.monthYear === `FY-${lastActualYear}` && r.subCategory == null && r.subItem == null)?.basis?.trim() || null
    : null;
  const lastActual: Record<string, number> = {};
  const lastBudget: Record<string, number> = {};
  if (lastActualYear != null) for (const sub of Object.keys(history)) {
    const a = history[sub]?.[lastActualYear]?.actual; if (a != null) lastActual[sub] = a;
    const b = history[sub]?.[lastActualYear]?.budget; if (b != null) lastBudget[sub] = b;
  }

  // Per-category review lock state (from the `__status__` marker) + who's viewing.
  const isAdmin = isManager;
  const statusRow = rows.find((r) => r.subItem === "__status__" && r.monthYear === `PROP-${targetYear}`);
  let review = { submitted: false, lastEditor: null as string | null, at: null as string | null };
  if (statusRow?.basis) {
    try { const d = JSON.parse(statusRow.basis); review = { submitted: !!d.submitted, lastEditor: d.lastEditor ?? null, at: d.at ?? null }; } catch { /* keep default */ }
  }

  const backHref = `/budget-proposal/build?vessel=${vessel.id}&year=${targetYear}`;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <Link href={backHref} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Back to {vessel.name} · FY {targetYear}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title={`${cat} · ${vessel.name}`} description={`FY ${targetYear} particulars — edit each line; the category total feeds back to the proposal.`} />
        {cat === "Crewing" && (
          <Link href={`/budget-proposal/build/crewing?vessel=${vessel.id}&year=${targetYear}`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-sky-300 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-700 shadow-sm hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
            <Users className="h-4 w-4" /> Additional notes for crewing
          </Link>
        )}
      </div>
      {lastNote && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-100">
          <span className="mr-1 font-semibold">📝 FY {lastActualYear} note (from OPEX):</span>
          <span className="whitespace-pre-wrap italic">{lastNote}</span>
        </div>
      )}
      {cat === "Lubricating Oil" ? (
        <LubeOilWorksheet
          vesselId={vessel.id}
          year={targetYear}
          proposed={proposed}
          header={{ days: proposed[""]?.days ?? null, basis: proposed[""]?.basis ?? null }}
          review={review} isAdmin={isAdmin}
          backHref={backHref}
        />
      ) : cat === "Management Fee" ? (
        <ManagementFeeWorksheet vesselId={vessel.id} year={targetYear} monthlyFee={proposed[""]?.rate ?? null} months={proposed[""]?.days ?? null} review={review} isAdmin={isAdmin} backHref={backHref} />
      ) : cat === "Repairs & Maintenance" ? (
        <RepairsWorksheet vesselId={vessel.id} year={targetYear} saved={rmSaved} carriedFrom={rmCarriedFrom} lastActual={lastActual} lastActualYear={lastActualYear} review={review} isAdmin={isAdmin} backHref={backHref} />
      ) : cat === "Stores & Supplies" || cat === "Operations" || cat === "Crewing" ? (
        <NotesWorksheet vesselId={vessel.id} year={targetYear} category={cat} particulars={particulars} proposed={proposed} lastActual={lastActual} lastBudget={lastBudget} lastActualYear={lastActualYear} review={review} isAdmin={isAdmin} backHref={backHref} />
      ) : (
        <CategoryEditor
          vesselId={vessel.id}
          year={targetYear}
          category={cat}
          particulars={particulars}
          histYears={histYears}
          history={history}
          proposed={proposed}
          review={review} isAdmin={isAdmin}
          backHref={backHref}
        />
      )}
    </div>
  );
}
