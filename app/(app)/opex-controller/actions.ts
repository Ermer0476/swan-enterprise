"use server";

import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { withAdvisoryLock } from "@/lib/db-lock";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth";
import { mapOpexCategory } from "./constants";
import { isSummaryWorkbook, parseSummaryWorkbook, type ParsedRecord, type ParsedVessel } from "./summaryParser";
import { isSoaWorkbook, parseSoaWorkbook } from "./soaParser";
import { canonicalizeSubItem } from "./canonicalSubItems";

// Delete all OPEX rows for a vessel + period (e.g. a wrong/duplicate year).
export async function deleteVesselYear(vesselId: string, monthYear: string) {
  const user = await requirePermission("opex:manage");
  if (!vesselId || !monthYear) return;
  const { count } = await prisma.budgetOpex.deleteMany({
    where: { companyId: user.companyId, vesselId, monthYear },
  });
  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "BudgetOpex",
    entityId: vesselId,
    summary: `Deleted ${count} OPEX row${count === 1 ? "" : "s"} for ${monthYear}`,
  });
  revalidatePath("/opex-controller");
}

// Upsert one budget/actual cell for a vessel + period + category. A row is
// created on first save and updated thereafter; variance is kept in step.
export async function saveOpexRow(input: {
  vesselId: string;
  monthYear: string; // "MM-YYYY"
  category: string;
  budgetAllocated: number;
  actualCost: number;
  note?: string; // variance explanation (why over/under budget) — stored in basis
}) {
  const user = await requirePermission("opex:manage");
  if (!input.vesselId || !input.monthYear || !input.category) return;

  const budgetAllocated = Number.isFinite(input.budgetAllocated) ? input.budgetAllocated : 0;
  const actualCost = Number.isFinite(input.actualCost) ? input.actualCost : 0;
  const variance = budgetAllocated - actualCost;
  const note = input.note !== undefined ? (input.note.trim() || null) : undefined;

  const lockKey = `budgetopex:${user.companyId}:${input.vesselId}:${input.monthYear}:${input.category}::`;
  const existing = await withAdvisoryLock(lockKey, async (tx) => {
    const row = await tx.budgetOpex.findFirst({
      where: { companyId: user.companyId, vesselId: input.vesselId, monthYear: input.monthYear, category: input.category, subCategory: null, subItem: null },
    });

    if (row) {
      await tx.budgetOpex.update({
        where: { id: row.id },
        data: { budgetAllocated, actualCost, variance, updatedBy: user.id, ...(note !== undefined ? { basis: note } : {}) },
      });
    } else {
      await tx.budgetOpex.create({
        data: {
          companyId: user.companyId,
          vesselId: input.vesselId,
          monthYear: input.monthYear,
          category: input.category,
          subCategory: null,
          budgetAllocated,
          actualCost,
          variance,
          basis: note ?? null,
          createdBy: user.id,
          updatedBy: user.id,
        },
      });
    }
    return row;
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "BudgetOpex",
    entityId: existing?.id ?? input.vesselId,
    summary: `Saved ${input.category} for ${input.monthYear} (budget ${budgetAllocated}, actual ${actualCost})`,
  });

  revalidatePath("/opex-controller");
}

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

export type OpexUploadResult = {
  ok: boolean;
  message: string;
  vessel?: string;
  categories?: number;
  totalBudget?: number;
  totalActual?: number;
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

type VesselRef = { id: string; name: string };

// Match a parsed vessel name against the fleet register (exact, then fuzzy).
// SWAN does NOT auto-create vessels on import (a Vessel needs a unique `code`
// and a companyId set under Vessels first) — unmatched names are skipped and
// reported so the user can add them and re-upload.
function matchVessel(name: string, vessels: VesselRef[]): VesselRef | undefined {
  const t = norm(name);
  return vessels.find((v) => norm(v.name) === t) ??
    vessels.find((v) => norm(v.name).includes(t) || t.includes(norm(v.name)));
}

// Upsert one vessel's category/sub-item rows for a period (overwrites, no dups).
// Raw line-item names are canonicalised to the standard particulars so they line
// up with the budget template; any that collapse to the same line are merged.
async function upsertOpexRecords(user: SessionUser, vesselId: string, monthYear: string, records: ParsedRecord[]) {
  const merged = new Map<string, { category: string; subCategory: string | null; budget: number; actual: number }>();
  for (const f of records) {
    const sub = f.subCategory ? canonicalizeSubItem(f.category, f.subCategory) : null;
    const key = `${f.category}|||${sub ?? ""}`;
    const cur = merged.get(key) ?? { category: f.category, subCategory: sub, budget: 0, actual: 0 };
    cur.budget += f.budget; cur.actual += f.actual;
    merged.set(key, cur);
  }
  await withAdvisoryLock(`budgetopex:${user.companyId}:${vesselId}:${monthYear}`, async (tx) => {
    for (const f of merged.values()) {
      const variance = f.budget - f.actual;
      const existing = await tx.budgetOpex.findFirst({
        where: { companyId: user.companyId, vesselId, monthYear, category: f.category, subCategory: f.subCategory },
      });
      if (existing) {
        await tx.budgetOpex.update({ where: { id: existing.id }, data: { budgetAllocated: f.budget, actualCost: f.actual, variance, updatedBy: user.id } });
      } else {
        await tx.budgetOpex.create({ data: { companyId: user.companyId, vesselId, monthYear, category: f.category, subCategory: f.subCategory, budgetAllocated: f.budget, actualCost: f.actual, variance, createdBy: user.id, updatedBy: user.id } });
      }
    }
  });
}

// Parse a Swan "OPEX Reporting" .xls/.xlsx (the "Opex Analysis" sheet), match
// the vessel by name, and upsert each budgeted category (Full-Year Budget +
// TOTAL OPEX actual) as FY-`year` rows. Re-uploading overwrites, no duplicates.
export async function uploadOpexExcel(_prev: OpexUploadResult | null, formData: FormData): Promise<OpexUploadResult> {
  const user = await requirePermission("opex:manage");

  const file = formData.get("file");
  const year = String(formData.get("year") || "2025");
  if (!file || typeof file === "string") return { ok: false, message: "No file selected." };

  let wb: XLSX.WorkBook;
  try {
    const buf = Buffer.from(await (file as File).arrayBuffer());
    wb = XLSX.read(buf, { type: "buffer" });
  } catch {
    return { ok: false, message: "Could not read the file — is it a valid Excel workbook?" };
  }

  // Multi-vessel "SUMMARY OF OPERATING EXPENSES" workbook (one sheet per vessel).
  if (isSummaryWorkbook(wb)) {
    return importSummaryWorkbook(user, parseSummaryWorkbook(wb), year);
  }

  // Monthly "Statement of Account" (SOA) workbook (one vessel, month blocks).
  if (isSoaWorkbook(wb)) {
    return importSummaryWorkbook(user, parseSoaWorkbook(wb), year);
  }

  // Pick the detailed-analysis sheet: prefer one named "Opex Analysis", else the
  // first sheet whose header carries a "TOTAL OPEX" column (some workbooks name
  // that sheet just "OPEX" and put a collapsed "SOA" sheet first — parsing the
  // SOA sheet would wrongly report "no budgeted categories").
  const sheetName =
    wb.SheetNames.find((n) => /opex\s*analysis/i.test(n)) ??
    wb.SheetNames.find((n) => {
      const sheet = wb.Sheets[n];
      if (!sheet) return false;
      const r = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });
      return r.slice(0, 12).some((row) => row.some((x) => /total\s*opex/i.test(String(x ?? ""))));
    }) ??
    wb.SheetNames[0];
  const ws = sheetName ? wb.Sheets[sheetName] : undefined;
  if (!ws) return { ok: false, message: "No 'Opex Analysis' sheet found." };
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false });

  // Vessel name: the cell just after a "Vessel:" label.
  let vesselName = "";
  outer: for (const r of rows.slice(0, 6)) {
    for (let c = 0; c < r.length; c++) {
      if (/vessel:?/i.test(String(r[c] ?? ""))) {
        vesselName = String(r.slice(c + 1).find((x) => String(x ?? "").trim()) ?? "").trim();
        if (vesselName) break outer;
      }
    }
  }
  if (!vesselName) return { ok: false, message: "Could not find the vessel name in the sheet." };

  // Locate the "TOTAL OPEX" (actual, col D) column; Full-Year Budget = D+3 (col G).
  let colActual = 17;
  for (const r of rows.slice(0, 10)) {
    const idx = r.findIndex((x) => /total\s*opex/i.test(String(x ?? "")));
    if (idx >= 0) { colActual = idx; break; }
  }
  const colBudget = colActual + 3;

  const vessels = await prisma.vessel.findMany({ where: { companyId: user.companyId, deletedAt: null }, select: { id: true, name: true } });

  // Walk the sheet: each category header captures a total row (subCategory
  // null); the mixed-case line items beneath it are stored as sub-items until
  // the next header or the grand-total row.
  const monthYear = `FY-${year}`;
  type Rec = { category: string; subCategory: string | null; budget: number; actual: number };
  const found: Rec[] = [];
  let currentCat: string | null = null;
  for (const r of rows) {
    const desc = String(r[1] ?? "").trim();
    if (!desc) continue;
    if (/total operating cost/i.test(desc)) break; // end of budgeted section
    if (/non-?budgeted|charterer|pre-?delivery|pre-?operating/i.test(desc)) { currentCat = null; continue; }

    const category = mapOpexCategory(desc);
    const actual = num(r[colActual]);
    const budget = num(r[colBudget]);
    if (category) {
      currentCat = category;
      found.push({ category, subCategory: null, budget, actual });
    } else if (currentCat && desc !== desc.toUpperCase() && (actual !== 0 || budget !== 0 || String(r[0] ?? "").trim())) {
      found.push({ category: currentCat, subCategory: desc, budget, actual });
    }
  }
  const catCount = found.filter((f) => f.subCategory === null).length;
  if (catCount === 0) return { ok: false, message: `Parsed "${vesselName}" but found no budgeted categories.` };

  // Resolve the vessel only once we know the file is valid. SWAN does NOT
  // auto-create vessels — if it isn't in the register, skip it and tell the user.
  const vessel = matchVessel(vesselName, vessels);
  if (!vessel) {
    return { ok: false, message: `Skipped unmatched vessel: ${vesselName} — add it under Vessels first, then re-upload.` };
  }
  await upsertOpexRecords(user, vessel.id, monthYear, found);

  const totals = found.filter((f) => f.subCategory === null);
  const totalBudget = totals.reduce((s, f) => s + f.budget, 0);
  const totalActual = totals.reduce((s, f) => s + f.actual, 0);

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "BudgetOpex",
    entityId: vessel.id,
    summary: `Imported ${catCount} OPEX categories for ${vessel.name} (FY ${year})`,
  });

  revalidatePath("/opex-controller");
  return {
    ok: true,
    message: `Imported ${catCount} categories (${found.length - catCount} line items) for ${vessel.name} (FY ${year}).`,
    vessel: vessel.name,
    categories: catCount,
    totalBudget,
    totalActual,
  };
}

// Import already-parsed vessels (from the summary or SOA parser): match each to
// the fleet register and upsert as FY-`year` rows. Unmatched vessels are skipped
// (SWAN never auto-creates vessels) and reported back so they can be added.
async function importSummaryWorkbook(user: SessionUser, parsedAll: ParsedVessel[], year: string): Promise<OpexUploadResult> {
  if (parsedAll.length === 0) return { ok: false, message: "No vessel sheets could be read from this workbook." };
  // De-duplicate by vessel: monthly-snapshot workbooks repeat the same vessel
  // across month sheets — keep the last (the full-year cumulative). One-sheet-
  // per-vessel workbooks have unique names, so they're unaffected.
  const byName = new Map<string, ParsedVessel>();
  for (const v of parsedAll) byName.set(v.vesselName.toLowerCase(), v);
  const parsed = [...byName.values()];

  const monthYear = `FY-${year}`;
  const vessels = await prisma.vessel.findMany({ where: { companyId: user.companyId, deletedAt: null }, select: { id: true, name: true } });

  const imported: { name: string; budget: number; actual: number }[] = [];
  const skipped: string[] = []; // spreadsheet vessels not found in the register
  for (const v of parsed) {
    const vessel = matchVessel(v.vesselName, vessels);
    if (!vessel) { skipped.push(v.vesselName); continue; }
    await upsertOpexRecords(user, vessel.id, monthYear, v.records);
    imported.push({ name: vessel.name, budget: v.totalBudget, actual: v.totalActual });
  }

  if (imported.length === 0) {
    const skipNote = skipped.length ? ` Skipped unmatched vessels: ${skipped.join(", ")} — add them under Vessels first, then re-upload.` : "";
    return { ok: false, message: `No vessels matched the fleet register.${skipNote}` };
  }

  const totalBudget = imported.reduce((s, v) => s + v.budget, 0);
  const totalActual = imported.reduce((s, v) => s + v.actual, 0);

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "BudgetOpex",
    entityId: null,
    summary: `Imported OPEX for ${imported.length} vessel(s) (FY ${year}): ${imported.map((v) => v.name).join(", ")}`,
  });

  revalidatePath("/opex-controller");
  const names = imported.map((v) => v.name).join(", ");
  const skipNote = skipped.length ? ` Skipped unmatched vessel${skipped.length > 1 ? "s" : ""}: ${skipped.join(", ")} — add ${skipped.length > 1 ? "them" : "it"} under Vessels first, then re-upload.` : "";
  return {
    ok: true,
    message: `Imported ${imported.length} vessel${imported.length > 1 ? "s" : ""} for FY ${year}: ${names}.${skipNote}`,
    vessel: names,
    categories: imported.length,
    totalBudget,
    totalActual,
  };
}
