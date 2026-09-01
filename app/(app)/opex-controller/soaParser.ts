import * as XLSX from "xlsx";
import type { ParsedRecord, ParsedVessel } from "./summaryParser";

// Parser for the monthly "Statement of Account" (SOA) template, a third OPEX
// layout distinct from "Opex Analysis" and "Summary of Operating Expenses".
// A single "SOA" sheet holds one vessel (name in a "Vessel:" cell) with twelve
// month blocks across the columns, each block three columns wide:
// Actual items / Budgeted items / Variance. Each budgeted category row (Crew
// Fee, Management Fee, …) is summed across all month blocks to give the
// full-year actual and budget, which reconcile with the sheet's own
// "Total Operating Cost" and "Fund received from owners" totals.

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

// Map an SOA category label (mixed-case, e.g. "Crew Fee", "Operation") to one
// of the canonical OPEX categories.
function mapSoaCat(desc: string): string | null {
  const d = desc.toLowerCase().trim();
  if (/^crew(ing)?\b|crew fee/.test(d)) return "Crewing";
  if (/management fee|technical management/.test(d)) return "Management Fee";
  if (/lubricating oil|lube oil/.test(d)) return "Lubricating Oil";
  if (/repairs?\s*&?\s*maintenance/.test(d)) return "Repairs & Maintenance";
  if (/stores?\s*&?\s*supplies/.test(d)) return "Stores & Supplies";
  if (/^operations?$/.test(d)) return "Operations";
  if (/drydock/.test(d)) return "Drydocking";
  return null;
}

// The header row is the one carrying two or more "Budgeted items" cells (one per
// month block). Returns -1 when the sheet isn't an SOA layout.
function findHeaderRow(rows: unknown[][]): number {
  return rows.findIndex(
    (r) => r.filter((c) => /budgeted items/i.test(String(c ?? ""))).length >= 2,
  );
}

function vesselNameOf(rows: unknown[][]): string {
  for (const r of rows.slice(0, 6)) {
    for (let c = 0; c < r.length; c++) {
      if (/vessel:?/i.test(String(r[c] ?? ""))) {
        const name = String(r.slice(c + 1).find((x) => String(x ?? "").trim()) ?? "").trim();
        if (name) return name;
      }
    }
  }
  return "";
}

function parseSoaSheet(rows: unknown[][]): ParsedVessel | null {
  const hdrIdx = findHeaderRow(rows);
  if (hdrIdx < 0) return null;
  const hdr = rows[hdrIdx];
  if (!hdr) return null;

  const actualCols: number[] = [];
  const budgetCols: number[] = [];
  hdr.forEach((c, i) => {
    if (/actual items/i.test(String(c ?? ""))) actualCols.push(i);
    if (/budgeted items/i.test(String(c ?? ""))) budgetCols.push(i);
  });
  if (actualCols.length === 0 || budgetCols.length === 0) return null;

  const vesselName = vesselNameOf(rows);
  if (!vesselName) return null;

  const records: ParsedRecord[] = [];
  let totalBudget = 0;
  let totalActual = 0;
  for (const r of rows.slice(hdrIdx + 1)) {
    const desc = String(r[1] ?? r[0] ?? "").trim();
    if (/vessel operating cost|total operating/i.test(desc)) break; // end of budgeted section
    const category = mapSoaCat(desc);
    if (!category) continue;
    const actual = actualCols.reduce((s, i) => s + num(r[i]), 0);
    const budget = budgetCols.reduce((s, i) => s + num(r[i]), 0);
    records.push({ category, subCategory: null, budget, actual });
    totalActual += actual;
    totalBudget += budget;
  }

  const catCount = records.length;
  if (catCount === 0) return null;
  return { vesselName, records, catCount, totalBudget, totalActual };
}

// True when the workbook is a monthly "Statement of Account" (SOA) file — any
// sheet has the Actual/Budgeted month-block header and a "Vessel:" label.
export function isSoaWorkbook(wb: XLSX.WorkBook): boolean {
  return wb.SheetNames.some((n) => {
    const sheet = wb.Sheets[n];
    if (!sheet) return false;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });
    return findHeaderRow(rows) >= 0 && !!vesselNameOf(rows);
  });
}

// Parse the (single-vessel) SOA workbook; returns an array for symmetry with the
// multi-vessel summary parser.
export function parseSoaWorkbook(wb: XLSX.WorkBook): ParsedVessel[] {
  for (const n of wb.SheetNames) {
    const sheet = wb.Sheets[n];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });
    const v = parseSoaSheet(rows);
    if (v) return [v];
  }
  return [];
}
