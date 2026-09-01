import * as XLSX from "xlsx";

export type ParsedInventoryRow = {
  subGroup: string | null;
  name: string;
  unit: string;
  qtyNew: number | null;
  qtyUsable: number | null;
  qtyReconditioned: number | null;
  remarks: string | null;
  sourceSheet: string;
};

export type FlaggedInventoryRow = {
  sourceSheet: string;
  rawText: string;
  reason: string;
};

const PAGE_MARKER = /^PAGE\b/i;

function cellStr(row: unknown[], idx: number): string | null {
  if (idx < 0) return null;
  const v = row[idx];
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s || null;
}

function isHeadingText(s: string): boolean {
  const letters = s.replace(/[^A-Za-z]/g, "");
  return letters.length >= 3 && letters === letters.toUpperCase();
}

function parseQty(v: string | null): number | null {
  if (v === null) return null;
  const s = v.trim();
  if (s === "" || s === "-") return null;
  if (s.toLowerCase() === "nil") return 0;
  const m = /^(\d+(\.\d+)?)/.exec(s);
  if (!m) return null;
  return Number(m[1]);
}

/**
 * Parses an uploaded vessel inventory workbook (.xls/.xlsx) that follows the
 * standard COA-style template: an "ITEM CODE" / "<description column>" /
 * "UNIT" / "QUANTITY" (split into New/Usable sub-columns) / "RECONDITIONED"
 * / "REMARKS" header row, ALL-CAPS section headings, and numbered item rows
 * optionally followed by unnumbered continuation rows (a second batch of the
 * same item — e.g. a different placement or spec variant).
 *
 * Deliberately conservative: a sheet with no "ITEM CODE" header is skipped
 * outright (most real workbooks carry unrelated leftover tabs), and any row
 * that doesn't clearly match a known pattern is returned in `flagged`
 * instead of guessed at — the caller shows both lists to the vessel for
 * review before anything is saved. Column position (not header wording) is
 * used to find UNIT/QUANTITY/etc. relative to "ITEM CODE" and "QUANTITY",
 * since the description-column header itself varies per file (sometimes
 * "DESCRIPTION", sometimes the product name).
 *
 * A single sheet may contain more than one table block (a fresh "ITEM CODE"
 * header row starts a new block, e.g. after a "PAGE n of m" marker) — each
 * is parsed independently, all feeding the same output lists.
 */
export function parseInventoryImportWorkbook(buffer: Buffer): {
  rows: ParsedInventoryRow[];
  flagged: FlaggedInventoryRow[];
  sheetsScanned: string[];
  sheetsSkipped: string[];
  error: string | null;
} {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer" });
  } catch {
    return { rows: [], flagged: [], sheetsScanned: [], sheetsSkipped: [], error: "Could not read this file — it may be corrupted or not a valid spreadsheet" };
  }

  const rows: ParsedInventoryRow[] = [];
  const flagged: FlaggedInventoryRow[] = [];
  const sheetsScanned: string[] = [];
  const sheetsSkipped: string[] = [];

  // Carries across sheets/blocks on purpose: a multi-page report often states
  // its section heading ("STATIONERIES") only once, on the first sheet, and
  // later sheets just continue the same list with no repeated heading —
  // resetting per-sheet would silently drop the Sub Category for every item
  // after the first page.
  let currentSubGroup: string | null = null;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as unknown[][];

    let sawHeaderInSheet = false;
    let i = 0;
    while (i < raw.length) {
      const row = raw[i] ?? [];
      const codeColIdx = row.findIndex((c) => typeof c === "string" && c.trim().toUpperCase() === "ITEM CODE");
      if (codeColIdx === -1) {
        i++;
        continue;
      }
      sawHeaderInSheet = true;

      const descIdx = codeColIdx + 1;
      const unitIdx = row.findIndex((c) => typeof c === "string" && c.trim().toUpperCase() === "UNIT");
      const qtyIdx = row.findIndex((c) => typeof c === "string" && c.trim().toUpperCase() === "QUANTITY");
      const reconditionedIdx = row.findIndex((c) => typeof c === "string" && c.trim().toUpperCase() === "RECONDITIONED");
      const remarksIdx = row.findIndex((c) => typeof c === "string" && c.trim().toUpperCase() === "REMARKS");
      const newIdx = qtyIdx;
      const usableIdx = qtyIdx === -1 ? -1 : qtyIdx + 1;

      let currentName: string | null = null;
      let currentUnit: string | null = null;
      let j = i + 1;

      for (; j < raw.length; j++) {
        const r = raw[j] ?? [];
        const code = cellStr(r, codeColIdx);
        const desc = cellStr(r, descIdx);
        const unit = cellStr(r, unitIdx);
        const qtyNewRaw = cellStr(r, newIdx);
        const qtyUsableRaw = cellStr(r, usableIdx);
        const qtyRecon = parseQty(cellStr(r, reconditionedIdx));
        const remarks = cellStr(r, remarksIdx);

        if (code && PAGE_MARKER.test(code)) break; // end of this block; outer loop looks for the next "ITEM CODE" header
        if (desc && /^DESCRIPTION$/i.test(desc) && !code && !unit && !qtyNewRaw && !qtyUsableRaw && !remarks) continue;
        if (!code && !desc && !unit && !qtyNewRaw && !qtyUsableRaw && !remarks) continue;
        // stray sub-header labels like "REMAINING BALANCE" / "NEW" / "USABLE" — position-matched, so just skip known junk text appearing alone
        if (!code && !desc && !remarks && (qtyNewRaw === "REMAINING BALANCE" || qtyNewRaw === "NEW")) continue;

        const qtyNew = parseQty(qtyNewRaw);
        const qtyUsable = parseQty(qtyUsableRaw);
        const hasQty = qtyNew !== null || qtyUsable !== null || qtyRecon !== null;

        if (desc && !code && !unit && !hasQty && !remarks && isHeadingText(desc)) {
          currentSubGroup = desc;
          currentName = null;
          currentUnit = null;
          continue;
        }

        if (code) {
          if (!desc) {
            flagged.push({ sourceSheet: sheetName, rawText: JSON.stringify(r), reason: `Row has an item code ("${code}") but no description` });
            continue;
          }
          currentName = desc;
          currentUnit = unit;
          rows.push({ subGroup: currentSubGroup, name: desc, unit: unit ?? "pc", qtyNew, qtyUsable, qtyReconditioned: qtyRecon, remarks, sourceSheet: sheetName });
          continue;
        }

        if (!code && desc && (unit || hasQty)) {
          // a distinct item with its own description but no code — keep it standalone, don't fold into the prior item
          rows.push({ subGroup: currentSubGroup, name: desc, unit: unit ?? currentUnit ?? "pc", qtyNew, qtyUsable, qtyReconditioned: qtyRecon, remarks, sourceSheet: sheetName });
          continue;
        }

        if (!code && !desc && currentName && (unit || hasQty || remarks)) {
          // continuation batch of the current item — a second placement/variant, disambiguated by its own remarks
          const name = remarks ? `${currentName} (${remarks})` : currentName;
          rows.push({ subGroup: currentSubGroup, name, unit: unit ?? currentUnit ?? "pc", qtyNew, qtyUsable, qtyReconditioned: qtyRecon, remarks: null, sourceSheet: sheetName });
          continue;
        }

        if (!code && desc && !unit && !hasQty && !remarks) {
          // narrative continuation (spec/expiry text) — fold into the last row's remarks rather than invent a new item
          const last = rows[rows.length - 1];
          if (last) {
            last.remarks = last.remarks ? `${last.remarks}; ${desc}` : desc;
            continue;
          }
        }

        flagged.push({ sourceSheet: sheetName, rawText: JSON.stringify(r), reason: "Row didn't match a recognized pattern" });
      }

      i = j;
    }

    if (sawHeaderInSheet) sheetsScanned.push(sheetName);
    else sheetsSkipped.push(sheetName);
  }

  return { rows, flagged, sheetsScanned, sheetsSkipped, error: null };
}
