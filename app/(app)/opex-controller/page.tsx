import Link from "next/link";
import { ChevronDown, Upload } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import DetailsAutoClose from "./DetailsAutoClose";
import OpexTable, { type OpexNode } from "./OpexTable";
import OpexUpload from "./OpexUpload";
import OpexFleetSection from "./OpexFleetSection";
import DeleteYearButton from "./DeleteYearButton";
import { OPEX_CATEGORIES, variancePct } from "./constants";

export const dynamic = "force-dynamic";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const peso = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const pct = (n: number | null) => (n === null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(1)}%`);

const periodLabel = (p: string) =>
  p.startsWith("FY-") ? `FY ${p.slice(3)}` : `${MONTHS[Number(p.split("-")[0]) - 1]} ${p.split("-")[1]}`;
const periodYear = (p: string) => (p.startsWith("FY-") ? p.slice(3) : p.split("-")[1] ?? String(new Date().getFullYear()));
const daysInYear = (yr: number) => ((yr % 4 === 0 && yr % 100 !== 0) || yr % 400 === 0 ? 366 : 365);

// A single at-a-glance status pill (coloured dot + bold value + label).
function StatusChip({ dot, value, label }: { dot: string; value: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5 text-xs ring-1 ring-slate-200">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      <span className="font-semibold tabular-nums text-slate-800">{value}</span>
      <span className="text-slate-500">{label}</span>
    </span>
  );
}

type SP = { vessel?: string; period?: string };

export default async function OpexControllerPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePermission("opex:read");
  const sp = await searchParams;

  // SWAN treats any non-ACTIVE vessel (LAID_UP / DRYDOCK / SOLD) as "archived"
  // for OPEX purposes; deleted vessels are excluded entirely.
  const vesselRows = await prisma.vessel.findMany({
    where: { companyId: user.companyId, deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, status: true },
  });
  const vessels = vesselRows.map((v) => ({ id: v.id, name: v.name, archived: v.status !== "ACTIVE" }));
  const activeVessels = vessels.filter((v) => !v.archived);

  // Period options: every FY year that already has data (so uploads of any year
  // — 2023, 2024, … — appear) plus sensible defaults, newest first; then the
  // monthly options for manual entry (current year).
  const existing = (await prisma.budgetOpex.findMany({ where: { companyId: user.companyId }, select: { monthYear: true }, distinct: ["monthYear"] })).map((x) => x.monthYear);
  const thisYear = new Date().getFullYear();
  const fyYears = new Set<string>([String(thisYear - 1), String(thisYear)]);
  for (const m of existing) if (m.startsWith("FY-")) fyYears.add(m.slice(3));
  const fyPeriods = [...fyYears].sort((a, b) => Number(b) - Number(a)).map((y) => `FY-${y}`);
  const monthlyPeriods = Array.from({ length: 12 }, (_, i) => `${String(i + 1).padStart(2, "0")}-${thisYear}`);
  const PERIODS = [...fyPeriods, ...monthlyPeriods];

  // Default to the PREVIOUS fiscal year (the current year usually has no actuals
  // yet) — e.g. in 2026 → FY-2025; in 2027 → FY-2026. Falls back to the newest
  // available if that year somehow isn't listed.
  const defaultFy = `FY-${thisYear - 1}`;
  const period = sp.period && PERIODS.includes(sp.period)
    ? sp.period
    : (PERIODS.includes(defaultFy) ? defaultFy : fyPeriods[0] ?? PERIODS[0] ?? defaultFy);

  // Fleet-wide rollup for the period. Only category totals (subCategory null) —
  // never the sub-item rows, or the totals would double-count.
  const all = await prisma.budgetOpex.findMany({ where: { companyId: user.companyId, monthYear: period, subCategory: null } });
  const byVessel = new Map<string, { budget: number; actual: number }>();
  for (const b of all) {
    const cur = byVessel.get(b.vesselId) ?? { budget: 0, actual: 0 };
    cur.budget += b.budgetAllocated;
    cur.actual += b.actualCost;
    byVessel.set(b.vesselId, cur);
  }
  const fleet = activeVessels
    .map((v) => ({ ...v, ...(byVessel.get(v.id) ?? { budget: 0, actual: 0 }) }))
    .filter((v) => v.budget > 0 || v.actual > 0)
    .sort((a, b) => (variancePct(a.budget, a.actual) ?? 0) - (variancePct(b.budget, b.actual) ?? 0));

  // Active vessels (uploaded first by variance, then pending A–Z) plus any
  // archived vessel that still has data for this period — shown so its history
  // stays viewable, tagged "archived", and ranked after the active uploaded ones.
  const activeRows = activeVessels.map((v) => {
    const d = byVessel.get(v.id);
    return { id: v.id, name: v.name, budget: d?.budget ?? 0, actual: d?.actual ?? 0, uploaded: !!d, archived: false };
  });
  const archivedRows = vessels
    .filter((v) => v.archived && byVessel.has(v.id))
    .map((v) => {
      const d = byVessel.get(v.id)!;
      return { id: v.id, name: v.name, budget: d.budget, actual: d.actual, uploaded: true, archived: true };
    });
  const rank = (r: { uploaded: boolean; archived: boolean }) => (r.archived ? 1 : r.uploaded ? 0 : 2);
  const fleetAll = [...activeRows, ...archivedRows].sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (rank(a) === 2) return a.name.localeCompare(b.name);
    return (variancePct(a.budget, a.actual) ?? 0) - (variancePct(b.budget, b.actual) ?? 0);
  });

  // At-a-glance status uses the ACTIVE fleet only, so sold vessels don't skew
  // completeness or the SMS health headline.
  const activeUploaded = activeRows.filter((v) => v.uploaded);
  const uploadedCount = activeUploaded.length;
  const within5Count = activeUploaded.filter((v) => {
    const p = variancePct(v.budget, v.actual);
    return p !== null && Math.abs(p) <= 5;
  }).length;
  // Over budget = breaching the SMS tolerance (spent >5% above budget), i.e. the
  // red bars in the variance chart — not every tiny overspend.
  const overBudgetCount = activeUploaded.filter((v) => {
    const p = variancePct(v.budget, v.actual);
    return p !== null && p < -5;
  }).length;
  const allUploaded = uploadedCount === activeVessels.length && activeVessels.length > 0;

  // Selected vessel (for the per-category detail below).
  const vesselId = sp.vessel && vessels.some((v) => v.id === sp.vessel) ? sp.vessel : fleet[0]?.id ?? activeVessels[0]?.id ?? vessels[0]?.id ?? "";
  const vessel = vessels.find((v) => v.id === vesselId);
  // Vessels selectable in the "change vessel" menu: active ones + archived ones
  // that have data for this period.
  const selectableVessels = [
    ...activeVessels.map((v) => ({ id: v.id, name: v.name, archived: false })),
    ...vessels.filter((v) => v.archived && byVessel.has(v.id)).map((v) => ({ id: v.id, name: v.name, archived: true })),
  ];
  const detail = await prisma.budgetOpex.findMany({ where: { companyId: user.companyId, vesselId, monthYear: period } });
  const detailCats = Array.from(new Set([...OPEX_CATEGORIES, ...detail.map((d) => d.category)]));
  const nodes: OpexNode[] = detailCats.map((category) => {
    const total = detail.find((d) => d.category === category && d.subCategory === null && d.subItem === null);
    const subs = detail
      .filter((d) => d.category === category && d.subCategory !== null && d.subItem === null)
      .map((d) => ({ name: d.subCategory as string, budget: d.budgetAllocated, actual: d.actualCost }));
    const budget = total?.budgetAllocated ?? subs.reduce((s, x) => s + x.budget, 0);
    const actual = total?.actualCost ?? subs.reduce((s, x) => s + x.actual, 0);
    return { category, budget, actual, subs, note: total?.basis ?? null };
  });

  // Per-vessel year-over-year (all FY periods for the selected vessel).
  const vesselAll = await prisma.budgetOpex.findMany({ where: { companyId: user.companyId, vesselId, subCategory: null } });
  const yoyMap = new Map<string, { budget: number; actual: number }>();
  for (const b of vesselAll) {
    if (!b.monthYear.startsWith("FY-")) continue;
    const y = b.monthYear.slice(3);
    const cur = yoyMap.get(y) ?? { budget: 0, actual: 0 };
    cur.budget += b.budgetAllocated;
    cur.actual += b.actualCost;
    yoyMap.set(y, cur);
  }
  const yoy = [...yoyMap.entries()]
    .map(([year, v]) => ({ year, ...v }))
    .sort((a, b) => Number(a.year) - Number(b.year));

  const link = (next: Partial<SP>) => {
    const q = new URLSearchParams({ vessel: vesselId, period, ...next } as Record<string, string>);
    return `/opex-controller?${q.toString()}`;
  };
  const menuItem = "block rounded-md px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-100";

  return (
    <div>
      <DetailsAutoClose />
      <PageHeader
        title="OPEX Controller"
        description="Budget Control · Per-vessel budget vs. actual expenses with variance traffic lights."
      />

      {/* Period + at-a-glance status. The period is prominent so it's instantly
          clear which year is on screen; import is tucked into a small button. */}
      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <details className="relative">
            <summary className="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Viewing period</p>
                <p className="flex items-center gap-1.5 text-2xl font-bold tracking-tight text-slate-900">
                  {periodLabel(period)}
                  <ChevronDown className="h-5 w-5 text-slate-400" />
                </p>
              </div>
            </summary>
            <div className="absolute left-0 z-30 mt-1 max-h-72 w-48 overflow-auto rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
              {PERIODS.map((p) => (
                <Link key={p} href={link({ period: p })} className={`${menuItem} ${p === period ? "bg-sky-50 font-semibold text-sky-700" : ""}`}>
                  {periodLabel(p)}
                </Link>
              ))}
            </div>
          </details>

          <details className="relative">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
              <Upload className="h-3.5 w-3.5 text-sky-600" /> Import data
              <ChevronDown className="h-3 w-3" />
            </summary>
            <div className="absolute right-0 z-30 mt-1 w-[360px] max-w-[90vw] rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
              <OpexUpload year={periodYear(period)} />
            </div>
          </details>
        </div>

        {/* Status strip — completeness first, then fleet health */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          {uploadedCount === 0 ? (
            <StatusChip dot="bg-slate-300" value="No data yet" label={`for ${periodLabel(period)} — import to begin`} />
          ) : (
            <>
              <StatusChip
                dot={allUploaded ? "bg-emerald-500" : "bg-amber-500"}
                value={`${uploadedCount} of ${activeVessels.length}`}
                label={allUploaded ? "vessels uploaded — complete" : `vessels uploaded · ${activeVessels.length - uploadedCount} pending`}
              />
              <StatusChip dot="bg-emerald-500" value={`${within5Count}`} label="within SMS ±5%" />
              <StatusChip dot={overBudgetCount > 0 ? "bg-red-500" : "bg-slate-300"} value={`${overBudgetCount}`} label="over budget" />
            </>
          )}
        </div>
      </div>

      {/* Fleet variance chart + collapsible fleet summary with per-vessel graph
          checkboxes (client). */}
      {/* key={period} remounts on period change so the graph selection resets
          to "all vessels checked" — the default — for each period. */}
      <OpexFleetSection
        key={period}
        rows={fleetAll}
        period={period}
        periodLabel={periodLabel(period)}
        vesselCount={activeVessels.length}
        selectedDetailId={vesselId}
      />

      {/* Per-vessel category detail */}
      {vessel && (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-800">Detail · {vessel.name}</p>
            <details className="relative">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                change vessel <ChevronDown className="h-3 w-3" />
              </summary>
              <div className="absolute left-0 z-30 mt-1 max-h-72 w-64 overflow-auto rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
                {selectableVessels.map((v) => (
                  <Link key={v.id} href={link({ vessel: v.id })} className={`${menuItem} flex items-center justify-between`}>
                    {v.name}
                    {v.archived && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Archived</span>}
                  </Link>
                ))}
              </div>
            </details>
          </div>
          <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <OpexTable nodes={nodes} vesselId={vesselId} monthYear={period} />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Click <span className="font-medium text-slate-600">Edit</span> to adjust a category. Utilization &gt; 100% is
            <span className="font-medium text-red-600"> Red</span> (over budget); 90–100% is
            <span className="font-medium text-amber-600"> Amber</span>.
          </p>

          {/* Year-over-year for the selected vessel */}
          {yoy.length > 0 && (
            <>
              <p className="mb-2 mt-6 text-sm font-semibold text-slate-800">Year-over-Year · {vessel.name}</p>
              <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-3 font-medium">Year</th>
                      <th className="px-3 py-3 text-right font-medium">Budget</th>
                      <th className="px-3 py-3 text-right font-medium">Actual</th>
                      <th className="px-3 py-3 text-right font-medium">Mo. Avg <span className="font-normal text-slate-400">(actual)</span></th>
                      <th className="px-3 py-3 text-right font-medium">Daily Avg <span className="font-normal text-slate-400">(actual)</span></th>
                      <th className="px-3 py-3 text-right font-medium">Variance</th>
                      <th className="px-3 py-3 text-right font-medium">Var %</th>
                      <th className="px-3 py-3 font-medium">SMS 5%</th>
                      <th className="px-3 py-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {yoy.map((y) => {
                      const vp = variancePct(y.budget, y.actual);
                      const ok = vp !== null && Math.abs(vp) <= 5;
                      return (
                        <tr key={y.year} className={`hover:bg-slate-50/60 ${`FY-${y.year}` === period ? "bg-sky-50/40" : ""}`}>
                          <td className="px-3 py-3">
                            <Link href={link({ period: `FY-${y.year}` })} className="font-medium text-sky-700 hover:underline">FY {y.year}</Link>
                          </td>
                          <td className="px-3 py-3 text-right text-slate-600">{peso(y.budget)}</td>
                          <td className="px-3 py-3 text-right text-slate-600">{peso(y.actual)}</td>
                          <td className="px-3 py-3 text-right text-slate-500">{peso(y.actual / 12)}</td>
                          <td className="px-3 py-3 text-right text-slate-500">{peso(y.actual / daysInYear(Number(y.year)))}</td>
                          <td className={`px-3 py-3 text-right font-medium ${y.budget - y.actual < 0 ? "text-red-600" : "text-emerald-700"}`}>{peso(y.budget - y.actual)}</td>
                          <td className={`px-3 py-3 text-right font-medium ${(vp ?? 0) < 0 ? "text-red-600" : "text-emerald-700"}`}>{pct(vp)}</td>
                          <td className="px-3 py-3">
                            <span className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold ${ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                              {ok ? "Within 5%" : "Over 5%"}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <DeleteYearButton vesselId={vesselId} monthYear={`FY-${y.year}`} label={`FY ${y.year} · ${vessel.name}`} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-slate-500">Click a year to jump to that period. SMS requires variance within ±5% of budget.</p>
            </>
          )}
        </>
      )}
    </div>
  );
}
