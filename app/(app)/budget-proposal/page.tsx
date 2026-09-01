import Link from "next/link";
import { Clock, CalendarClock, Send, AlertTriangle, Calculator, Archive, FilePen, ClipboardCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/rbac";
import ScheduleEditButton from "./ScheduleEditButton";
import { createScheduleForVessel } from "./actions";

export const dynamic = "force-dynamic";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthIdx = (m: string | null) => (m ? MONTHS.indexOf(m) : 99);
const monthShort = (m: string | null) => (m ? m.slice(0, 3) : "—");
const fmtMY = (d: Date | null) => (d ? `${(MONTHS[d.getUTCMonth()] ?? "").slice(0, 3)} ${d.getUTCFullYear()}` : "—");
const dateVal = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
// Next budget should be prepared 3 months before the current contract ends.
const prepareBy = (contractTo: Date | null) => {
  if (!contractTo) return null;
  const d = new Date(contractTo);
  d.setUTCMonth(d.getUTCMonth() - 3);
  return d;
};

export default async function BudgetProposalPage() {
  const user = await requirePermission("budget:read");
  // Monitoring covers the whole active fleet — each active vessel shows its
  // budget schedule if it has one, or a "No schedule yet" tag if it doesn't.
  // Archived (sold/former) vessels drop out entirely.
  const activeVessels = await prisma.vessel.findMany({ where: { companyId: user.companyId, deletedAt: null, status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  const schedules = await prisma.budgetSchedule.findMany({ where: { companyId: user.companyId } });
  const schedByVessel = new Map(schedules.filter((s) => s.vesselId).map((s) => [s.vesselId as string, s]));

  // Budget-review state per vessel for the current build year: whether a budget
  // is built and the review status/note (from the `__meta__` marker row).
  const buildYear = new Date().getUTCFullYear() + 1;
  const propRows = await prisma.budgetOpex.findMany({
    where: { companyId: user.companyId, monthYear: `PROP-${buildYear}` },
    select: { vesselId: true, category: true, budgetAllocated: true, subItem: true, basis: true },
  });
  const reviewByVessel = new Map<string, { built: boolean; status: string | null; note: string | null }>();
  // Per vessel: budgeted categories vs submitted (locked) ones. A budgeted
  // category that isn't submitted is still "Open".
  const proposedCats = new Map<string, Set<string>>();
  const submittedCats = new Map<string, Set<string>>();
  const ownerStage = new Map<string, string>(); // vesselId → "for_review" | "approved"
  const addTo = (m: Map<string, Set<string>>, vid: string, cat: string) => (m.get(vid) ?? m.set(vid, new Set()).get(vid)!).add(cat);
  for (const r of propRows) {
    const cur = reviewByVessel.get(r.vesselId) ?? { built: false, status: null, note: null };
    if (r.category === "__meta__") { cur.status = r.subItem; cur.note = r.basis; reviewByVessel.set(r.vesselId, cur); continue; }
    if (r.category === "__approved__") { if (r.basis) { try { const d = JSON.parse(r.basis); ownerStage.set(r.vesselId, d.stage === "approved" ? "approved" : "for_review"); } catch { /* ignore */ } } reviewByVessel.set(r.vesselId, cur); continue; }
    if (r.category === "__report__") { reviewByVessel.set(r.vesselId, cur); continue; }
    if (r.subItem === "__status__") {
      if (r.basis) { try { if (JSON.parse(r.basis).submitted) addTo(submittedCats, r.vesselId, r.category); } catch { /* ignore */ } }
      reviewByVessel.set(r.vesselId, cur); continue;
    }
    if (r.subItem === "__crewparticulars__") { reviewByVessel.set(r.vesselId, cur); continue; }
    if (r.subItem == null && r.budgetAllocated > 0) { cur.built = true; addTo(proposedCats, r.vesselId, r.category); }
    else if (r.budgetAllocated > 0) cur.built = true;
    reviewByVessel.set(r.vesselId, cur);
  }
  const hasOpenCategory = (vid: string) => { const p = proposedCats.get(vid); if (!p) return false; const s = submittedCats.get(vid) ?? new Set(); return [...p].some((c) => !s.has(c)); };
  // Budget-building progress shown in the Budget column, derived entirely from the
  // app: build status → review status → owner-flow stage. Owner stages win.
  const budgetProgress = (vesselId: string): { label: string; cls: string } => {
    const rv = reviewByVessel.get(vesselId);
    if (!rv || !rv.built) return { label: "Not yet started", cls: "bg-slate-100 text-slate-500" };
    const stage = ownerStage.get(vesselId);
    if (stage === "approved") return { label: "Approved by owners", cls: "bg-emerald-100 text-emerald-700" };
    if (stage === "for_review") return { label: "Pending owner approval", cls: "bg-violet-100 text-violet-700" };
    // Derived: every budgeted category completed (nothing Open) → auto "For Review".
    if (!hasOpenCategory(vesselId)) return { label: "For Review", cls: "bg-amber-100 text-amber-700" };
    return { label: "Drafting", cls: "bg-sky-100 text-sky-700" };
  };

  const now = new Date();
  const curMonth = now.getMonth();
  // Months from now until a given month, wrapping the year (0 = this month).
  const gapFromNow = (m: string | null) => (monthIdx(m) >= 12 ? 99 : (monthIdx(m) - curMonth + 12) % 12);
  // Contract ending within 3 months → the next budget must be prepared now.
  const isPrepDue = (s: (typeof schedules)[number]) => { const pb = prepareBy(s.contractTo); return pb !== null && now >= pb; };

  type Row = { vessel: { id: string; name: string }; sched: (typeof schedules)[number] | null };
  const rows: Row[] = activeVessels.map((v) => ({ vessel: v, sched: schedByVessel.get(v.id) ?? null }));
  // "Prepare now" vessels come first so they're seen at a glance, then the rest
  // ordered by the workflow cycle (Submit-to-Mgt month, counting from now).
  const withSched = rows.filter((r) => r.sched).sort((a, b) => {
    const da = isPrepDue(a.sched!) ? 0 : 1, db = isPrepDue(b.sched!) ? 0 : 1;
    if (da !== db) return da - db;
    return gapFromNow(a.sched!.submitToMgt) - gapFromNow(b.sched!.submitToMgt) || (a.sched!.sortOrder ?? 999) - (b.sched!.sortOrder ?? 999);
  });
  const noSched = rows.filter((r) => !r.sched).sort((a, b) => a.vessel.name.localeCompare(b.vessel.name));
  const ordered = [...withSched, ...noSched];
  // Split by derived state (same labels as the Budget column): "Budget drafted" =
  // still Drafting (a category is open); "Budget for review" = all categories
  // completed. Sent/approved ones move to their own tiles.
  const draftedCount = ordered.filter((r) => budgetProgress(r.vessel.id).label === "Drafting").length;
  const forReviewCount = ordered.filter((r) => budgetProgress(r.vessel.id).label === "For Review").length;
  // "Still to prepare" = contract ending soon AND no budget built yet (derived
  // from real data, matching the dashboard's "Prepare now") — a vessel already
  // being drafted drops out of this count.
  const toPrepare = withSched.filter((r) => isPrepDue(r.sched!) && !reviewByVessel.get(r.vessel.id)?.built).length;
  // Due within 3 months = not yet built and the submit-to-management month is
  // within 3 months (derived + schedule, no Notion status).
  const isDue = (vesselId: string, s: (typeof schedules)[number]) =>
    !reviewByVessel.get(vesselId)?.built && monthIdx(s.submitToMgt) < 99 && ((monthIdx(s.submitToMgt) - curMonth + 12) % 12) <= 3;
  const dueSoon = withSched.filter((r) => isDue(r.vessel.id, r.sched!));
  const prepAlerts = withSched.filter((r) => isPrepDue(r.sched!));
  // Vessels currently with the owners for review (submitted, awaiting sign-off).
  const withOwnersCount = [...ownerStage.values()].filter((s) => s === "for_review").length;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Budget Proposal Builder"
          description="Fleet budget schedule — which vessel needs a new budget and when."
        />
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link
            href="/budget-proposal/approved"
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 shadow-sm hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
          >
            <Archive className="h-4 w-4" /> Approved budgets
          </Link>
          <Link
            href="/budget-proposal/build"
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
          >
            <Calculator className="h-4 w-4" /> Build a budget
          </Link>
        </div>
      </div>

      {/* At-a-glance status */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-2xl font-bold tracking-tight text-slate-900">{rows.length}</p>
          <p className="mt-0.5 text-xs font-medium text-slate-500">Active vessels</p>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 shadow-sm ring-1 ring-sky-100">
          <p className="flex items-center gap-1.5 text-2xl font-bold tracking-tight text-sky-700"><FilePen className="h-5 w-5" />{draftedCount}</p>
          <p className="mt-0.5 text-xs font-semibold text-sky-700">Budget drafting</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm ring-1 ring-emerald-100">
          <p className="flex items-center gap-1.5 text-2xl font-bold tracking-tight text-emerald-700"><ClipboardCheck className="h-5 w-5" />{forReviewCount}</p>
          <p className="mt-0.5 text-xs font-semibold text-emerald-700">Budget for review</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm ring-1 ring-amber-100">
          <p className="flex items-center gap-1.5 text-2xl font-bold tracking-tight text-amber-700"><Clock className="h-5 w-5" />{toPrepare}</p>
          <p className="mt-0.5 text-xs font-semibold text-amber-700">Still to prepare</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="flex items-center gap-1.5 text-2xl font-bold tracking-tight text-slate-900"><CalendarClock className="h-5 w-5 text-slate-400" />{dueSoon.length}</p>
          <p className="mt-0.5 text-xs font-medium text-slate-500">Due within 3 months</p>
        </div>
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 shadow-sm ring-1 ring-violet-100">
          <p className="flex items-center gap-1.5 text-2xl font-bold tracking-tight text-violet-700"><Send className="h-5 w-5" />{withOwnersCount}</p>
          <p className="mt-0.5 text-xs font-semibold text-violet-700">Pending owner approval</p>
        </div>
      </div>

      {prepAlerts.length > 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50/70 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p><span className="font-semibold">Prepare next budget:</span>{" "}
            {prepAlerts.map((r) => `${r.vessel.name} (contract ends ${fmtMY(r.sched!.contractTo)})`).join(", ")} — contract ending soon; start the next budget now (prepare 3 months before it ends).</p>
        </div>
      )}
      {dueSoon.length > 0 && (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-800">
          <span className="font-semibold">Next up:</span>{" "}
          {dueSoon.map((r) => `${r.vessel.name} (${monthShort(r.sched!.submitToMgt)})`).join(", ")} — time to prepare the budget.
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-3 font-semibold">Vessel</th>
              <th className="px-4 py-3 font-semibold">Contract</th>
              <th className="px-4 py-3 font-semibold">Submit to Mgt</th>
              <th className="px-4 py-3 font-semibold">Submit to Owners</th>
              <th className="px-4 py-3 font-semibold">Budget</th>
              <th className="px-4 py-3 font-semibold">Next Budget <span className="font-normal text-slate-400">(3 mo before contract ends)</span></th>
              <th className="px-4 py-3 font-semibold">BFA</th>
              <th className="px-4 py-3 font-semibold"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ordered.map(({ vessel, sched }) => {
              if (!sched) {
                return (
                  <tr key={vessel.id} className="bg-red-50/30 text-slate-400 hover:bg-red-50/50">
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/opex-controller?vessel=${vessel.id}`} className="font-bold text-slate-700 hover:underline dark:text-slate-100">{vessel.name}</Link>
                    </td>
                    <td className="px-4 py-3" colSpan={6}>
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">No schedule yet</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <form action={createScheduleForVessel.bind(null, vessel.id, vessel.name)}>
                        <button type="submit" className="whitespace-nowrap text-xs font-medium text-sky-600 hover:underline">+ Add schedule</button>
                      </form>
                    </td>
                  </tr>
                );
              }
              const due = isDue(vessel.id, sched);
              const prepBy = prepareBy(sched.contractTo);
              const prepDue = prepBy ? now >= prepBy : false; // contract ends within 3 months → prepare next budget
              return (
                <tr key={vessel.id} className={`hover:bg-slate-50/60 ${due ? "bg-amber-50/40" : ""}`}>
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/opex-controller?vessel=${vessel.id}`} className="font-bold text-sky-700 hover:underline">{vessel.name}</Link>
                    <Link href={`/budget-proposal/build?vessel=${vessel.id}`} className="mt-1.5 inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-md border border-amber-300 bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 hover:border-amber-400 hover:bg-amber-200 dark:border-amber-700/60 dark:bg-amber-900/30 dark:text-amber-200 dark:hover:bg-amber-900/50">
                      <Calculator className="h-3.5 w-3.5 shrink-0" /> Build budget →
                    </Link>
                  </td>
                  <td className={`px-4 py-3 whitespace-nowrap ${due ? "font-semibold text-amber-700" : "text-slate-600"}`}>{fmtMY(sched.contractFrom)} – {fmtMY(sched.contractTo)}</td>
                  <td className="px-4 py-3 text-slate-600">{sched.submitToMgt ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{sched.submitToOwners ?? "—"}</td>
                  <td className="px-4 py-3">
                    {(() => { const b = budgetProgress(vessel.id); const rv = reviewByVessel.get(vessel.id); return (
                      <span title={rv?.note ?? undefined} className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold ${b.cls}`}>{b.label}</span>
                    ); })()}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {!prepBy ? <span className="text-slate-400">—</span>
                      : prepDue
                        ? <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700"><AlertTriangle className="h-3.5 w-3.5" />Prepare now · by {fmtMY(prepBy)}</span>
                        : <span className="text-slate-500">by {fmtMY(prepBy)}</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{sched.bfa ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <ScheduleEditButton sched={{
                      id: sched.id, vesselName: vessel.name,
                      submitToMgt: sched.submitToMgt ?? "", submitToOwners: sched.submitToOwners ?? "",
                      contractFrom: dateVal(sched.contractFrom), contractTo: dateVal(sched.contractTo),
                      nextContractFrom: dateVal(sched.nextContractFrom), nextContractTo: dateVal(sched.nextContractTo),
                      bfa: sched.bfa ?? "", remarks: sched.remarks ?? "",
                    }} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-slate-400">
        All active vessels shown. Amber = budget due within 3 months · red = no schedule yet. Vessel names link to their OPEX detail. Budget status is derived from the actual proposals built in the app.
      </p>
    </div>
  );
}
