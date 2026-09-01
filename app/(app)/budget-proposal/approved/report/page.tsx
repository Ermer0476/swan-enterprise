import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { OPEX_CATEGORIES } from "../../../opex-controller/constants";
import { orderByCanonical } from "../../../opex-controller/canonicalSubItems";
import { glCode, SECTION_TITLE } from "../../glCodes";
import ReportDoc from "./ReportDoc";

export const dynamic = "force-dynamic";

type SP = { [k: string]: string | string[] | undefined };

const CARRY_FIELDS = ["imo", "mainEngine", "crew", "itf"]; // static per vessel — carry forward

export default async function OwnerReportPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePermission("budget:read");
  const sp = await searchParams;
  const vesselId = typeof sp.vessel === "string" ? sp.vessel : "";
  const year = typeof sp.year === "string" && /^\d{4}$/.test(sp.year) ? Number(sp.year) : 0;

  const vessel = vesselId ? await prisma.vessel.findFirst({ where: { id: vesselId, companyId: user.companyId } }) : null;
  const marker = year ? await prisma.budgetOpex.findFirst({ where: { companyId: user.companyId, vesselId, monthYear: `PROP-${year}`, category: "__approved__" }, select: { basis: true } }) : null;
  if (!vessel || !year || !marker) notFound();

  let mk: { stage?: string; approvedBy?: string; approvedAt?: string; submittedBy?: string; submittedAt?: string; periodStart?: string; periodEnd?: string } = {};
  try { mk = marker.basis ? JSON.parse(marker.basis) : {}; } catch { /* ignore */ }
  const stage = mk.stage === "approved" ? "approved" : "for_review";
  const approved = { periodStart: mk.periodStart, periodEnd: mk.periodEnd };

  // Editable report particulars for this year, with static fields carried from
  // the most recent prior year's report so they aren't re-typed annually.
  const reportRows = await prisma.budgetOpex.findMany({ where: { companyId: user.companyId, vesselId, category: "__report__" }, select: { monthYear: true, basis: true } });
  const parseReport = (b: string | null) => { try { return b ? (JSON.parse(b) as Record<string, string>) : {}; } catch { return {}; } };
  const fields: Record<string, string> = parseReport(reportRows.find((r) => r.monthYear === `PROP-${year}`)?.basis ?? null);
  const priors = reportRows
    .map((r) => ({ y: Number(/^PROP-(\d{4})$/.exec(r.monthYear)?.[1] ?? 0), f: parseReport(r.basis) }))
    .filter((x) => x.y && x.y < year)
    .sort((a, b) => b.y - a.y);
  for (const key of CARRY_FIELDS) {
    if (!fields[key]) { const prior = priors.find((p) => p.f[key]); const v = prior?.f[key]; if (v) fields[key] = v; }
  }

  // Crewing particulars (manning list + notes) for the report's A. Crew Costs.
  const crewRow = await prisma.budgetOpex.findFirst({ where: { companyId: user.companyId, vesselId, monthYear: `PROP-${year}`, category: "Crewing", subItem: "__crewparticulars__" }, select: { basis: true } });
  let crewing: { nationality: string; itf: string; manning: { count: number; position: string }[]; notes: string } | null = null;
  try { crewing = crewRow?.basis ? JSON.parse(crewRow.basis) : null; } catch { /* ignore */ }

  // Proposal figures live in PROP-<year> (the working draft) so the report shows
  // the current proposal whether it's still for owner review or already approved.
  // Full detail: category totals, particulars (notes + lube calc), and R&M
  // 3rd-level sub-items (with expiry).
  const rows = await prisma.budgetOpex.findMany({
    where: { companyId: user.companyId, vesselId, monthYear: `PROP-${year}` },
    select: { category: true, subCategory: true, subItem: true, budgetAllocated: true, basis: true, days: true, qty: true, rate: true, rob: true, expiry: true },
  });
  type Particular = { name: string; code: string; amount: number; note: string | null; days: number | null; qty: number | null; rate: number | null; rob: number | null };
  type RmItem = { name: string; amount: number; expiry: string | null; note: string | null };
  const catTotal: Record<string, number> = {};
  const catMeta: Record<string, { days: number | null; rate: number | null }> = {};
  const subMap: Record<string, Record<string, Particular>> = {};
  const rmItems: Record<string, RmItem[]> = {}; // keyed by R&M group (subCategory)
  for (const r of rows) {
    if (r.category.startsWith("__")) continue;
    if (r.subCategory == null && r.subItem == null) { catTotal[r.category] = r.budgetAllocated; catMeta[r.category] = { days: r.days, rate: r.rate }; continue; }
    if (r.subItem != null && r.subItem !== "__status__" && r.subItem !== "__crewparticulars__") { // R&M 3rd-level
      (rmItems[r.subCategory ?? ""] ??= []).push({ name: r.subItem, amount: r.budgetAllocated, expiry: r.expiry, note: r.basis });
      continue;
    }
    if (r.subItem != null) continue; // other markers (__status__, __crewparticulars__)
    if (r.subCategory != null) {
      (subMap[r.category] ??= {})[r.subCategory] = { name: r.subCategory, code: glCode(r.category, r.subCategory), amount: r.budgetAllocated, note: r.basis, days: r.days, qty: r.qty, rate: r.rate, rob: r.rob };
    }
  }

  // Section model (A, B, C…), each with coded particular lines + subtotal.
  // Letters are assigned in order; empty categories (e.g. no Drydocking that
  // year) are dropped so the proposal reads like the real one.
  const sections = OPEX_CATEGORIES.filter((c) => c !== "Management Fee").map((cat) => {
    const group = subMap[cat] ?? {};
    const names = orderByCanonical(cat, Object.keys(group));
    const lines = names.map((n) => group[n]).filter((x): x is Particular => x != null);
    const subtotal = catTotal[cat] ?? lines.reduce((s, l) => s + l.amount, 0);
    return { key: cat, title: SECTION_TITLE[cat] ?? cat, lines, subtotal, rmItems: cat === "Repairs & Maintenance" ? rmItems : null };
  }).filter((s) => s.subtotal !== 0 || s.lines.length > 0)
    .map((s, i) => ({ ...s, letter: String.fromCharCode(65 + i) }));
  const mgmtLetter = String.fromCharCode(65 + sections.length); // the letter after the last section
  const mgmtFee = catTotal["Management Fee"] ?? 0;
  const mgmtMonths = catMeta["Management Fee"]?.days ?? 12;
  const total = sections.reduce((s, x) => s + x.subtotal, 0) + mgmtFee;
  const costPerDay = total / 365;

  // Monthly billing split (as in the proposal): crewing / opex / management ÷ 12.
  const crewSub = sections.find((s) => s.key === "Crewing")?.subtotal ?? 0;
  const opexSub = sections.filter((s) => s.key !== "Crewing").reduce((s, x) => s + x.subtotal, 0);
  const monthly = { crewing: crewSub / 12, opex: opexSub / 12, mgmt: mgmtFee / (mgmtMonths || 12), total: 0 };
  monthly.total = monthly.crewing + monthly.opex + monthly.mgmt;

  return (
    <ReportDoc
      vesselId={vessel.id}
      year={year}
      vessel={{
        name: vessel.name, type: vessel.type, capacityCbm: vessel.capacityCbm, grt: vessel.grossTonnage,
        flag: vessel.flag, vesselClass: vessel.classificationSociety, yearBuilt: vessel.yearBuilt, yearWithSwan: vessel.yearWithSwan,
        tradeArea: vessel.tradeArea, owner: vessel.registeredOwner ?? vessel.headOwner ?? null,
      }}
      period={{ start: approved.periodStart ?? null, end: approved.periodEnd ?? null }}
      stage={stage}
      fields={fields}
      crewing={crewing}
      sections={sections}
      mgmtFee={mgmtFee}
      mgmtLetter={mgmtLetter}
      total={total}
      costPerDay={costPerDay}
      monthly={monthly}
    />
  );
}
