import * as XLSX from "xlsx";

// Parser for the raw "SUMMARY OF OPERATING EXPENSES" accounting export, where a
// single workbook holds one vessel per sheet (e.g. CORAL2024.xlsx → DC/JC/OC/PC
// = Diamond/Jasmine/Orchid/Plumeria Coral). This layout differs from the
// "Opex Analysis" report: the vessel name sits in a quoted cell up top, the
// OPEX (actual) / FULL-YEAR BUDGET columns must be located per sheet, category
// totals live either on the header row (Diamond-style) or on a "Sub-total X"
// row (Orchid-style, lettered groups), and any unmapped lettered group is
// folded into Operations so the category totals reconcile with the grand total.

export type ParsedRecord = { category: string; subCategory: string | null; budget: number; actual: number };
export type ParsedVessel = { vesselName: string; records: ParsedRecord[]; catCount: number; totalBudget: number; totalActual: number };

const OTHER = "__OTHER__";

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const isLetter = (s: unknown) => /^[A-Z]\.?$/.test(String(s ?? "").trim());

// Map a description to one of the seven canonical OPEX categories
// (case-insensitive — Crewing/Management appear mixed-case in this template).
function mapCat(desc: string): string | null {
  const d = desc.toLowerCase().trim();
  if (/lumpsum crewing|^crewing\b/.test(d)) return "Crewing";
  if (/technical management|management fee/.test(d)) return "Management Fee";
  if (/lubricating oil/.test(d)) return "Lubricating Oil";
  if (/repairs?\s*&?\s*maintenance/.test(d)) return "Repairs & Maintenance";
  if (/stores?\s*&?\s*supplies/.test(d)) return "Stores & Supplies";
  if (/^operations$/.test(d)) return "Operations";
  if (/drydock/.test(d)) return "Drydocking";
  return null;
}

// First non-empty of cols 0..2 that is not a bare letter label ("A.", "B.").
function descOf(r: unknown[]): string {
  for (const c of [0, 1, 2]) {
    const s = String(r[c] ?? "").trim();
    if (s && !/^[A-Z]\.?$/.test(s)) return s;
  }
  return "";
}

function isSummarySheet(rows: unknown[][]): boolean {
  return rows.slice(0, 6).some((r) => r.some((c) => /summary of operating expenses/i.test(String(c ?? ""))));
}

function vesselNameOf(rows: unknown[][]): string {
  for (const r of rows.slice(0, 4)) {
    for (const c of r) {
      const s = String(c ?? "").trim();
      const m = s.match(/^"?([A-Za-z][A-Za-z .\/-]+?)"?$/);
      if (s.startsWith('"') && m && m[1]) return m[1].trim();
    }
  }
  return "";
}

function findColActual(rows: unknown[][]): number {
  for (const r of rows.slice(0, 10)) {
    const idx = r.findIndex((x) => /^opex$/i.test(String(x ?? "").trim()));
    if (idx >= 0) return idx;
  }
  for (const r of rows.slice(0, 10)) {
    const idx = r.findIndex((x) => /total\s*opex/i.test(String(x ?? "")));
    if (idx >= 0) return idx;
  }
  return -1;
}

// The full-year budget column, located by its "ANNUAL"/"FULL YEAR" header to
// the right of OPEX. Layouts differ: some sheets carry YTD columns (budget at
// OPEX+3), others don't (budget at OPEX+1). Falls back to OPEX+3.
function findColBudget(rows: unknown[][], colActual: number): number {
  for (const r of rows.slice(0, 10)) {
    const idx = r.findIndex((x, i) => i > colActual && /annual|full\s*year/i.test(String(x ?? "")));
    if (idx >= 0) return idx;
  }
  return colActual + 3;
}

function parseSheet(rows: unknown[][]): ParsedVessel | null {
  if (!isSummarySheet(rows)) return null;
  const vesselName = vesselNameOf(rows);
  const colActual = findColActual(rows);
  const colBudget = findColBudget(rows, colActual);
  if (!vesselName || colActual < 0) return null;

  type Entry = { budget: number; actual: number; headerTotal: boolean; subs: { name: string; budget: number; actual: number }[] };
  const cats = new Map<string, Entry>();
  const ensure = (c: string): Entry => {
    let e = cats.get(c);
    if (!e) { e = { budget: 0, actual: 0, headerTotal: false, subs: [] }; cats.set(c, e); }
    return e;
  };
  let currentCat: string | null = null;
  let otherA = 0, otherB = 0;

  for (const r of rows) {
    const desc = descOf(r);
    if (!desc && !isLetter(r[0])) continue;
    if (/^total budgetary expenses/i.test(desc)) break; // end of budgeted section
    if (/^disbursements|^code$|^\(in us dollar/i.test(desc)) continue;

    const actual = num(r[colActual]);
    const budget = num(r[colBudget]);

    if (/^sub-?total\b/i.test(desc)) {
      if (currentCat === OTHER) { otherA += actual; otherB += budget; }
      else if (currentCat) {
        const e = cats.get(currentCat);
        if (e && !e.headerTotal) { e.actual = actual; e.budget = budget; }
      }
      continue;
    }

    const cat = mapCat(desc);
    const groupHeader = isLetter(r[0]);
    if (cat) {
      currentCat = cat;
      const e = ensure(cat);
      if (actual !== 0 || budget !== 0) { e.actual = actual; e.budget = budget; e.headerTotal = true; }
    } else if (groupHeader) {
      currentCat = OTHER; // unmapped lettered group → folded into Operations
    } else if (currentCat && currentCat !== OTHER && (actual !== 0 || budget !== 0 || String(r[0] ?? "").trim())) {
      cats.get(currentCat)!.subs.push({ name: desc, budget, actual });
    }
  }

  if (otherA !== 0 || otherB !== 0) {
    const ops = ensure("Operations");
    ops.actual += otherA; ops.budget += otherB;
  }
  for (const [, e] of cats) {
    if (!e.headerTotal && e.actual === 0 && e.budget === 0 && e.subs.length) {
      e.actual = e.subs.reduce((s, x) => s + x.actual, 0);
      e.budget = e.subs.reduce((s, x) => s + x.budget, 0);
    }
  }

  const records: ParsedRecord[] = [];
  let totalBudget = 0, totalActual = 0;
  for (const [category, e] of cats) {
    records.push({ category, subCategory: null, budget: e.budget, actual: e.actual });
    totalBudget += e.budget; totalActual += e.actual;
    for (const s of e.subs) records.push({ category, subCategory: s.name, budget: s.budget, actual: s.actual });
  }
  const catCount = cats.size;
  if (catCount === 0) return null;
  return { vesselName, records, catCount, totalBudget, totalActual };
}

// True when the workbook is a multi-vessel "SUMMARY OF OPERATING EXPENSES" file
// (any sheet matches the template) rather than an "Opex Analysis" report.
export function isSummaryWorkbook(wb: XLSX.WorkBook): boolean {
  if (wb.SheetNames.some((n) => /opex\s*analysis/i.test(n))) return false;
  return wb.SheetNames.some((n) => {
    const sheet = wb.Sheets[n];
    if (!sheet) return false;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });
    return isSummarySheet(rows);
  });
}

// Parse every vessel sheet in a summary workbook.
export function parseSummaryWorkbook(wb: XLSX.WorkBook): ParsedVessel[] {
  const out: ParsedVessel[] = [];
  for (const n of wb.SheetNames) {
    const sheet = wb.Sheets[n];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });
    const v = parseSheet(rows);
    if (v) out.push(v);
  }
  return out;
}
