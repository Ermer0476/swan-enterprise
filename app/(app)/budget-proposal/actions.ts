"use server";

import { prisma } from "@/lib/prisma";
import { withAdvisoryLock } from "@/lib/db-lock";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

const DATE_FIELDS = ["contractFrom", "contractTo", "nextContractFrom", "nextContractTo"];
const TEXT_FIELDS = ["status", "submitToMgt", "submitToOwners", "budgetStatus", "bfa", "remarks"];

// Update a single field of a budget-schedule row (inline table editing).
export async function updateScheduleField(id: string, field: string, value: string) {
  const user = await requirePermission("budget:manage");
  if (!id) return;

  const data: Record<string, unknown> = {};
  if (DATE_FIELDS.includes(field)) {
    const d = value ? new Date(value) : null;
    data[field] = d && !isNaN(d.getTime()) ? d : null;
  } else if (field === "budgetStatus") {
    data.budgetStatus = value.trim() || "Pending";
  } else if (TEXT_FIELDS.includes(field)) {
    data[field] = value.trim() === "" ? null : value.trim();
    // Once approved, the submission process is done — clear the submit months.
    if (field === "status" && value === "APPROVED") {
      data.submitToMgt = null;
      data.submitToOwners = null;
    }
  } else {
    return;
  }

  await prisma.budgetSchedule.updateMany({ where: { id, companyId: user.companyId }, data });
  await writeAudit({ actor: user, action: "UPDATE", entityType: "BudgetProposal", entityId: id, summary: `Updated budget schedule field ${field}` });
  revalidatePath("/budget-proposal");
}

// Save a vessel's draft budget proposal for a target fiscal year. Proposal
// figures live in the OPEX table under a `PROP-<year>` period so they never
// collide with, or pollute, the real `FY-<year>` actuals — yet reuse the same
// storage (no schema change). Editing happens at the particulars (sub-category)
// level; each category also carries a subCategory-null total row so the OPEX
// views read correctly. The whole period is rewritten so removed particulars
// don't linger.
export type ProposalParticular = {
  subCategory: string;
  amount: number;
  days?: number | null;
  qty?: number | null;
  rate?: number | null;
  rob?: number | null;
  orderQty?: number | null;
  basis?: string | null;
};

// Save a category proposal where the rows already carry every worksheet field
// (days/qty/rate/orderQty/basis) verbatim — used by bespoke worksheets like the
// Lubricating Oils sheet. A category-header meta row (subCategory null) can hold
// shared assumptions in its own days/basis. Rewrites only this category's rows.
export async function saveWorksheetProposal(
  vesselId: string,
  year: number,
  category: string,
  rows: ProposalParticular[],
  headerMeta?: { days?: number | null; basis?: string | null },
) {
  const user = await requirePermission("budget:manage");
  if (!vesselId || !year || !category) return;
  const companyId = user.companyId;
  const monthYear = `PROP-${year}`;
  const numOrNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const clean = rows
    .map((p) => ({
      subCategory: p.subCategory.trim(),
      amount: Number.isFinite(p.amount) ? p.amount : 0,
      days: numOrNull(p.days), qty: numOrNull(p.qty), rate: numOrNull(p.rate),
      rob: numOrNull(p.rob), orderQty: numOrNull(p.orderQty), basis: p.basis?.trim() ? p.basis.trim() : null,
    }))
    .filter((p) => p.subCategory);
  const total = clean.reduce((s, p) => s + p.amount, 0);
  const data = [
    ...clean.map((p) => ({ companyId, vesselId, monthYear, category, subCategory: p.subCategory, budgetAllocated: p.amount, actualCost: 0, variance: p.amount, days: p.days, qty: p.qty, rate: p.rate, rob: p.rob, orderQty: p.orderQty, basis: p.basis })),
    { companyId, vesselId, monthYear, category, subCategory: null, budgetAllocated: total, actualCost: 0, variance: total, days: numOrNull(headerMeta?.days), qty: null, rate: null, rob: null, orderQty: null, basis: headerMeta?.basis?.trim() ? headerMeta.basis.trim() : null },
  ];
  await withAdvisoryLock(`budgetopex:${companyId}:${vesselId}:${monthYear}:${category}`, async (tx) => {
    await tx.budgetOpex.deleteMany({ where: { companyId, vesselId, monthYear, category } });
    await tx.budgetOpex.createMany({ data });
  });
  await writeAudit({ actor: user, action: "UPDATE", entityType: "BudgetProposal", entityId: vesselId, summary: `Saved ${category} worksheet proposal for ${monthYear}` });
  revalidatePath("/budget-proposal/build");
  revalidatePath("/budget-proposal/build/category");
}

export async function saveCategoryProposal(
  vesselId: string,
  year: number,
  category: string,
  particulars: ProposalParticular[],
  lumpAmount?: number,
  lumpMeta?: { days?: number | null; qty?: number | null; rate?: number | null; basis?: string | null },
) {
  const user = await requirePermission("budget:manage");
  if (!vesselId || !year || !category) return;
  const companyId = user.companyId;
  const monthYear = `PROP-${year}`;
  const numOrNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const clean = particulars
    .map((p) => ({
      subCategory: p.subCategory.trim(),
      amount: Number.isFinite(p.amount) ? p.amount : 0,
      days: numOrNull(p.days),
      qty: numOrNull(p.qty),
      rate: numOrNull(p.rate),
      basis: p.basis?.trim() ? p.basis.trim() : null,
    }))
    .filter((p) => p.subCategory);
  // Category total = sum of particulars, or the lump amount when there are none.
  const total = clean.length ? clean.reduce((s, p) => s + p.amount, 0) : (Number.isFinite(lumpAmount) ? Number(lumpAmount) : 0);
  // When lump-sum (no particulars), the total row itself carries the basis.
  const totalMeta = clean.length
    ? { days: null, qty: null, rate: null, basis: null }
    : { days: numOrNull(lumpMeta?.days), qty: numOrNull(lumpMeta?.qty), rate: numOrNull(lumpMeta?.rate), basis: lumpMeta?.basis?.trim() ? lumpMeta.basis.trim() : null };
  const data = [
    ...clean.map((p) => ({ companyId, vesselId, monthYear, category, subCategory: p.subCategory, budgetAllocated: p.amount, actualCost: 0, variance: p.amount, days: p.days, qty: p.qty, rate: p.rate, basis: p.basis })),
    { companyId, vesselId, monthYear, category, subCategory: null, budgetAllocated: total, actualCost: 0, variance: total, ...totalMeta },
  ];
  // Rewrite just this category's budget rows for the period (subItem null),
  // leaving other categories' rows and marker rows (__status__, __crewparticulars__)
  // intact.
  await withAdvisoryLock(`budgetopex:${companyId}:${vesselId}:${monthYear}:${category}`, async (tx) => {
    await tx.budgetOpex.deleteMany({ where: { companyId, vesselId, monthYear, category, subItem: null } });
    await tx.budgetOpex.createMany({ data });
  });
  await writeAudit({ actor: user, action: "UPDATE", entityType: "BudgetProposal", entityId: vesselId, summary: `Saved ${category} proposal for ${monthYear}` });
  revalidatePath("/budget-proposal/build");
  revalidatePath("/budget-proposal/build/category");
}

// Save a 3-level grouped proposal (e.g. Repairs & Maintenance): each group is a
// sub-category with its own sub-items. Writes sub-item rows (subItem set), a
// group-total row (subItem null) that feeds the summary, and the category total.
// Rewrites only this category's PROP rows for the period.
export async function saveGroupedProposal(
  vesselId: string,
  year: number,
  category: string,
  groups: { group: string; flat?: boolean; amount?: number; items?: { name: string; amount: number; note?: string | null; expiry?: string | null }[] }[],
) {
  const user = await requirePermission("budget:manage");
  if (!vesselId || !year || !category) return;
  const companyId = user.companyId;
  const monthYear = `PROP-${year}`;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const data: {
    companyId: string; vesselId: string; monthYear: string; category: string; subCategory: string | null; subItem: string | null;
    budgetAllocated: number; actualCost: number; variance: number; expiry: string | null; basis: string | null;
  }[] = [];
  let catTotal = 0;
  for (const g of groups) {
    const items = (g.items ?? []).filter((it) => it.name?.trim());
    const groupTotal = g.flat ? num(g.amount) : items.reduce((s, it) => s + num(it.amount), 0);
    catTotal += groupTotal;
    for (const it of items) {
      data.push({ companyId, vesselId, monthYear, category, subCategory: g.group, subItem: it.name.trim(), budgetAllocated: num(it.amount), actualCost: 0, variance: num(it.amount), expiry: it.expiry?.trim() ? it.expiry.trim() : null, basis: it.note?.trim() ? it.note.trim() : null });
    }
    data.push({ companyId, vesselId, monthYear, category, subCategory: g.group, subItem: null, budgetAllocated: groupTotal, actualCost: 0, variance: groupTotal, expiry: null, basis: null });
  }
  data.push({ companyId, vesselId, monthYear, category, subCategory: null, subItem: null, budgetAllocated: catTotal, actualCost: 0, variance: catTotal, expiry: null, basis: null });
  await withAdvisoryLock(`budgetopex:${companyId}:${vesselId}:${monthYear}:${category}`, async (tx) => {
    await tx.budgetOpex.deleteMany({ where: { companyId, vesselId, monthYear, category } });
    await tx.budgetOpex.createMany({ data });
  });
  await writeAudit({ actor: user, action: "UPDATE", entityType: "BudgetProposal", entityId: vesselId, summary: `Saved ${category} grouped proposal for ${monthYear}` });
  revalidatePath("/budget-proposal/build");
  revalidatePath("/budget-proposal/build/category");
}

// Save the Crewing proposal: a manning scale + monthly cost items compute the 7
// Crew Cost lines (× 12). The 7 lines are stored as sub-category rows (feed the
// summary); the full manning/item detail is kept as JSON on the category-total
// row's `basis` so the worksheet can be reopened and carried forward.
const CREW_LINE_NAMES = ["Crew Wages", "Crew Travel incl. Handling", "Crew Pre-Emp Costs", "Social Charges", "Union Dues", "Crew Provisions", "Miscellaneous"];
export async function saveCrewingProposal(
  vesselId: string,
  year: number,
  manning: { rank: string; count: number; wage: number }[],
  items: { name: string; line: string; amount: number }[],
) {
  const user = await requirePermission("budget:manage");
  if (!vesselId || !year) return;
  const companyId = user.companyId;
  const monthYear = `PROP-${year}`;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const manningMonthly = manning.reduce((s, m) => s + n(m.count) * n(m.wage), 0);
  const annual: Record<string, number> = {};
  for (const line of CREW_LINE_NAMES) {
    const base = line === "Crew Wages" ? manningMonthly : 0;
    const itemsSum = items.filter((i) => i.line === line).reduce((s, i) => s + n(i.amount), 0);
    annual[line] = (base + itemsSum) * 12;
  }
  const total = CREW_LINE_NAMES.reduce((s, l) => s + (annual[l] ?? 0), 0);
  const detail = JSON.stringify({ manning, items });
  const data = [
    ...CREW_LINE_NAMES.map((line) => ({ companyId, vesselId, monthYear, category: "Crewing", subCategory: line, subItem: null, budgetAllocated: annual[line] ?? 0, actualCost: 0, variance: annual[line] ?? 0, basis: null })),
    { companyId, vesselId, monthYear, category: "Crewing", subCategory: null, subItem: null, budgetAllocated: total, actualCost: 0, variance: total, basis: detail },
  ];
  await withAdvisoryLock(`budgetopex:${companyId}:${vesselId}:${monthYear}:Crewing`, async (tx) => {
    await tx.budgetOpex.deleteMany({ where: { companyId, vesselId, monthYear, category: "Crewing" } });
    await tx.budgetOpex.createMany({ data });
  });
  await writeAudit({ actor: user, action: "UPDATE", entityType: "BudgetProposal", entityId: vesselId, summary: `Saved Crewing proposal for ${monthYear}` });
  revalidatePath("/budget-proposal/build");
  revalidatePath("/budget-proposal/build/category");
}

// Save a budget's review status + note (who has reviewed it). Stored as a
// `__meta__` marker row inside the PROP-<year> period so no schema change is
// needed; it's excluded from summaries, totals, and approval.
export async function saveBudgetReview(vesselId: string, year: number, status: string, note: string) {
  const user = await requirePermission("budget:manage");
  if (!vesselId || !year) return;
  const companyId = user.companyId;
  const monthYear = `PROP-${year}`;
  const data = { subItem: status?.trim() || null, basis: note?.trim() || null };
  await withAdvisoryLock(`budgetopex:${companyId}:${vesselId}:${monthYear}:__meta__::`, async (tx) => {
    const existing = await tx.budgetOpex.findFirst({ where: { companyId, vesselId, monthYear, category: "__meta__" } });
    if (existing) {
      await tx.budgetOpex.update({ where: { id: existing.id }, data });
    } else {
      await tx.budgetOpex.create({ data: { companyId, vesselId, monthYear, category: "__meta__", subCategory: null, budgetAllocated: 0, actualCost: 0, variance: 0, ...data } });
    }
  });
  await writeAudit({ actor: user, action: "UPDATE", entityType: "BudgetProposal", entityId: vesselId, summary: `Saved budget review status for ${monthYear}` });
  revalidatePath("/budget-proposal");
  revalidatePath("/budget-proposal/build");
}

// Save a budget's period (start → end month, e.g. Jul 2025 – Jun 2026). Stored
// as JSON in the `__meta__` marker row's `subCategory` field so no schema change
// is needed; excluded from summaries/totals/approval like the rest of __meta__.
export async function saveBudgetPeriod(vesselId: string, year: number, start: string, end: string) {
  const user = await requirePermission("budget:manage");
  if (!vesselId || !year) return;
  const companyId = user.companyId;
  const monthYear = `PROP-${year}`;
  const period = start || end ? JSON.stringify({ start: start || null, end: end || null }) : null;
  await withAdvisoryLock(`budgetopex:${companyId}:${vesselId}:${monthYear}:__meta__::`, async (tx) => {
    const existing = await tx.budgetOpex.findFirst({ where: { companyId, vesselId, monthYear, category: "__meta__" } });
    if (existing) {
      await tx.budgetOpex.update({ where: { id: existing.id }, data: { subCategory: period } });
    } else {
      await tx.budgetOpex.create({ data: { companyId, vesselId, monthYear, category: "__meta__", subCategory: period, budgetAllocated: 0, actualCost: 0, variance: 0 } });
    }
  });
  // Keep the schedule dashboard in sync: the budget period is the contract year
  // the proposal covers, so mirror it onto the vessel's BudgetSchedule row (this
  // is what the dashboard "Contract" column and the "prepare now" alert read).
  // Build the dates in UTC so they match how the migrated schedule dates are
  // stored (UTC midnight) — using local time shifts them a day in +08:00.
  const sParts = start ? start.split("-").map(Number) : [];
  const sy = sParts[0];
  const sm = sParts[1];
  const toStart = start && sy && sm ? new Date(Date.UTC(sy, sm - 1, 1)) : null;
  let toEnd: Date | null = null;
  if (end) {
    const eParts = end.split("-").map(Number);
    const ey = eParts[0];
    const em = eParts[1];
    if (ey && em) toEnd = new Date(Date.UTC(ey, em, 0)); // last day of the end month (UTC)
  }
  if (toStart || toEnd) {
    await prisma.budgetSchedule.updateMany({
      where: { companyId, vesselId },
      data: { contractFrom: toStart, contractTo: toEnd },
    });
  }

  await writeAudit({ actor: user, action: "UPDATE", entityType: "BudgetProposal", entityId: vesselId, summary: `Saved budget period for ${monthYear}` });
  revalidatePath("/budget-proposal/build");
  revalidatePath("/budget-proposal");
}

// Save the Crewing "Particulars" for the owner report: manning list (position ×
// count, editable because crew changes), nationality/ITF, and editable notes
// (default-filled). Stored as a `__crewparticulars__` marker in Crewing's
// PROP-<year> data (no schema change); excluded from budget totals/approval.
export async function saveCrewingParticulars(vesselId: string, year: number, data: { nationality: string; itf: string; manning: { count: number; position: string }[]; notes: string }) {
  const user = await requirePermission("budget:manage");
  if (!vesselId || !year) return;
  const companyId = user.companyId;
  const monthYear = `PROP-${year}`;
  const json = JSON.stringify({
    nationality: data.nationality ?? "",
    itf: data.itf ?? "",
    manning: (data.manning ?? []).filter((m) => m.position?.trim()).map((m) => ({ count: Number(m.count) || 0, position: m.position.trim() })),
    notes: data.notes ?? "",
  });
  await withAdvisoryLock(`budgetopex:${companyId}:${vesselId}:${monthYear}:Crewing::__crewparticulars__`, async (tx) => {
    const existing = await tx.budgetOpex.findFirst({ where: { companyId, vesselId, monthYear, category: "Crewing", subItem: "__crewparticulars__" } });
    if (existing) {
      await tx.budgetOpex.update({ where: { id: existing.id }, data: { basis: json } });
    } else {
      await tx.budgetOpex.create({ data: { companyId, vesselId, monthYear, category: "Crewing", subCategory: null, subItem: "__crewparticulars__", budgetAllocated: 0, actualCost: 0, variance: 0, basis: json } });
    }
  });
  await writeAudit({ actor: user, action: "UPDATE", entityType: "BudgetProposal", entityId: vesselId, summary: `Saved crewing particulars for ${monthYear}` });
  revalidatePath("/budget-proposal/build/category");
  revalidatePath("/budget-proposal/approved/report");
}

// Per-category review lock: mark a category submitted (locked) or reopen it, and
// record who last updated it. Stored as a `__status__` marker row inside the
// category's PROP data (no schema change); excluded from summaries/approval.
export async function markCategoryReview(vesselId: string, year: number, category: string, submitted: boolean) {
  const user = await requirePermission("budget:manage");
  if (!vesselId || !year || !category) return;
  const companyId = user.companyId;
  const monthYear = `PROP-${year}`;
  const meta = JSON.stringify({ submitted, lastEditor: user.fullName, at: new Date().toISOString() });
  await withAdvisoryLock(`budgetopex:${companyId}:${vesselId}:${monthYear}:${category}::__status__`, async (tx) => {
    const existing = await tx.budgetOpex.findFirst({ where: { companyId, vesselId, monthYear, category, subCategory: null, subItem: "__status__" } });
    if (existing) {
      await tx.budgetOpex.update({ where: { id: existing.id }, data: { basis: meta } });
    } else {
      await tx.budgetOpex.create({ data: { companyId, vesselId, monthYear, category, subCategory: null, subItem: "__status__", budgetAllocated: 0, actualCost: 0, variance: 0, basis: meta } });
    }
  });
  await writeAudit({ actor: user, action: "UPDATE", entityType: "BudgetProposal", entityId: vesselId, summary: `Marked ${category} ${submitted ? "submitted" : "reopened"} for ${monthYear}` });
  revalidatePath("/budget-proposal");
  revalidatePath("/budget-proposal/build");
  revalidatePath("/budget-proposal/build/category");
}

// Save the owner-report particulars (IMO, main engine, crew, ITF, issued-to,
// revision, date) that aren't in the vessel register. Stored as a `__report__`
// marker in PROP-<year> (JSON in basis); no schema change. The report page
// carries the static fields forward from the latest prior year.
export async function saveReportFields(vesselId: string, year: number, fields: Record<string, string>) {
  const user = await requirePermission("budget:manage");
  if (!vesselId || !year) return;
  const companyId = user.companyId;
  const monthYear = `PROP-${year}`;
  const json = JSON.stringify(fields ?? {});
  await withAdvisoryLock(`budgetopex:${companyId}:${vesselId}:${monthYear}:__report__::`, async (tx) => {
    const existing = await tx.budgetOpex.findFirst({ where: { companyId, vesselId, monthYear, category: "__report__" } });
    if (existing) {
      await tx.budgetOpex.update({ where: { id: existing.id }, data: { basis: json } });
    } else {
      await tx.budgetOpex.create({ data: { companyId, vesselId, monthYear, category: "__report__", subCategory: null, subItem: null, budgetAllocated: 0, actualCost: 0, variance: 0, basis: json } });
    }
  });
  await writeAudit({ actor: user, action: "UPDATE", entityType: "BudgetProposal", entityId: vesselId, summary: `Saved owner report fields for ${monthYear}` });
  revalidatePath("/budget-proposal/approved/report");
}

// Grand total + budget period for the owner-flow marker.
async function proposalSummary(companyId: string, vesselId: string, year: number) {
  const totals = await prisma.budgetOpex.findMany({ where: { companyId, vesselId, monthYear: `PROP-${year}`, subCategory: null, subItem: null, NOT: { category: { in: ["__meta__", "__approved__", "__report__"] } } }, select: { budgetAllocated: true } });
  const total = totals.reduce((s, r) => s + r.budgetAllocated, 0);
  const metaRow = await prisma.budgetOpex.findFirst({ where: { companyId, vesselId, monthYear: `PROP-${year}`, category: "__meta__" }, select: { subCategory: true } });
  let periodStart: string | null = null, periodEnd: string | null = null;
  if (metaRow?.subCategory) { try { const pp = JSON.parse(metaRow.subCategory) as { start?: string | null; end?: string | null }; periodStart = pp.start ?? null; periodEnd = pp.end ?? null; } catch { /* ignore */ } }
  return { total, periodStart, periodEnd };
}

// Upsert the owner-flow marker (`__approved__` in PROP so OPEX stays clean),
// merging into any existing fields (keeps submittedBy when approving, etc.).
async function upsertOwnerMarker(companyId: string, vesselId: string, year: number, patch: Record<string, unknown>) {
  const monthYear = `PROP-${year}`;
  await withAdvisoryLock(`budgetopex:${companyId}:${vesselId}:${monthYear}:__approved__::`, async (tx) => {
    const existing = await tx.budgetOpex.findFirst({ where: { companyId, vesselId, monthYear, category: "__approved__" } });
    let prev: Record<string, unknown> = {};
    if (existing?.basis) { try { prev = JSON.parse(existing.basis) as Record<string, unknown>; } catch { /* ignore */ } }
    const basis = JSON.stringify({ ...prev, ...patch });
    if (existing) await tx.budgetOpex.update({ where: { id: existing.id }, data: { basis } });
    else await tx.budgetOpex.create({ data: { companyId, vesselId, monthYear, category: "__approved__", subCategory: null, subItem: null, budgetAllocated: 0, actualCost: 0, variance: 0, basis } });
  });
}

// Stage 1 — Submit to owners: send the proposal for owner review. Does NOT enter
// the official FY budget yet; records a "for_review" marker so it shows in the
// repository as "For review by owners". Re-submitting after edits refreshes it.
export async function submitToOwners(vesselId: string, year: number) {
  const user = await requirePermission("budget:manage");
  if (!vesselId || !year) return;
  const companyId = user.companyId;
  const { total, periodStart, periodEnd } = await proposalSummary(companyId, vesselId, year);
  await upsertOwnerMarker(companyId, vesselId, year, { stage: "for_review", submittedBy: user.fullName, submittedAt: new Date().toISOString(), total, periodStart, periodEnd });
  await writeAudit({ actor: user, action: "CREATE", entityType: "BudgetProposal", entityId: vesselId, summary: `Submitted FY ${year} proposal to owners` });
  revalidatePath("/budget-proposal");
  revalidatePath("/budget-proposal/approved");
  revalidatePath("/budget-proposal/build");
}

// Stage 2 — Approved by owners: the owner signed off. Marks the repository entry
// "Approved by owners". Does NOT touch OPEX — the OPEX Controller's budget comes
// from the actual OPEX data upload (which already includes the budget), so
// proposals are kept out of OPEX to avoid clutter/duplication.
export async function approveByOwners(vesselId: string, year: number) {
  const user = await requirePermission("budget:manage");
  if (!vesselId || !year) return;
  const companyId = user.companyId;
  const { total, periodStart, periodEnd } = await proposalSummary(companyId, vesselId, year);
  await upsertOwnerMarker(companyId, vesselId, year, { stage: "approved", approvedBy: user.fullName, approvedAt: new Date().toISOString(), total, periodStart, periodEnd });
  await writeAudit({ actor: user, action: "UPDATE", entityType: "BudgetProposal", entityId: vesselId, summary: `Approved FY ${year} budget by owners` });
  revalidatePath("/budget-proposal");
  revalidatePath("/budget-proposal/approved");
  revalidatePath("/opex-controller");
}

// Create a blank budget-schedule row for a vessel that has none yet, so it can
// be filled in via the edit controls.
export async function createScheduleForVessel(vesselId: string, vesselName: string) {
  const user = await requirePermission("budget:manage");
  if (!vesselId) return;
  const companyId = user.companyId;
  const existing = await prisma.budgetSchedule.findFirst({ where: { companyId, vesselId } });
  if (existing) return;
  await prisma.budgetSchedule.create({
    data: { companyId, vesselName, vesselId, status: "PROPOSED", budgetStatus: "Pending" },
  });
  await writeAudit({ actor: user, action: "CREATE", entityType: "BudgetProposal", entityId: vesselId, summary: `Created budget schedule for ${vesselName}` });
  revalidatePath("/budget-proposal");
}
