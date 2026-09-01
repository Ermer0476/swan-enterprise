import * as XLSX from "xlsx";

export type ParsedQuestionnaireItem = {
  chapter: number;
  no: string;
  question: string;
  shortText: string | null;
  personInCharge: string | null;
  smsProcRefs: string | null;
};

const REQUIRED_HEADERS = ["No", "Question"];

function cell(row: unknown[], idx: number): string | null {
  if (idx === -1) return null;
  const v = row[idx];
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed || null;
}

/**
 * Parses an uploaded SIRE 2.0 Questionnaire spreadsheet (.xlsx/.xlsm) into
 * question items. Column order isn't assumed — the header row is located by
 * scanning for cells that read "No" and "Question" (case-sensitive, matching
 * the office's own template), and every other column is read by name off
 * that row. This is deliberately resilient to OCIMF/the office reordering or
 * adding columns in a future version, rather than hardcoding positions —
 * confirmed against two real exports this session that had every other
 * column in a different order but identical header names.
 *
 * Chapter is derived from the leading number in the "No" column (e.g.
 * "4.2.3" -> chapter 4) rather than read from a separate column, since the
 * source sheets don't carry chapter as its own field.
 */
export function parseQuestionnaireWorkbook(buffer: Buffer): {
  items: ParsedQuestionnaireItem[];
  skipped: number;
  error: string | null;
} {
  let rows: unknown[][];
  try {
    const wb = XLSX.read(buffer, { type: "buffer" });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) return { items: [], skipped: 0, error: "The workbook has no sheets" };
    rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]!, { header: 1, defval: null }) as unknown[][];
  } catch {
    return { items: [], skipped: 0, error: "Could not read this file — it may be corrupted or not a valid spreadsheet" };
  }

  const headerRowIdx = rows.findIndex(
    (r) => Array.isArray(r) && REQUIRED_HEADERS.every((h) => r.some((c) => typeof c === "string" && c.trim() === h)),
  );
  if (headerRowIdx === -1) {
    return {
      items: [],
      skipped: 0,
      error: `No header row found with both "${REQUIRED_HEADERS.join('" and "')}" columns`,
    };
  }

  const header = (rows[headerRowIdx] as unknown[]).map((c) => (typeof c === "string" ? c.trim() : ""));
  const idx = {
    no: header.indexOf("No"),
    question: header.indexOf("Question"),
    shortText: header.indexOf("Short Text"),
    personInCharge: header.indexOf("Person in Charge"),
    smsProcRefs: header.indexOf("SMS Proc (All related)"),
  };

  const items: ParsedQuestionnaireItem[] = [];
  let skipped = 0;
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const no = cell(row, idx.no);
    const question = cell(row, idx.question);
    const chapterMatch = no ? /^(\d+)\./.exec(no) : null;
    if (!chapterMatch || !question) {
      if (no || question) skipped++;
      continue;
    }
    items.push({
      chapter: Number(chapterMatch[1]),
      no: no!,
      question,
      shortText: cell(row, idx.shortText),
      personInCharge: cell(row, idx.personInCharge),
      smsProcRefs: cell(row, idx.smsProcRefs),
    });
  }

  return { items, skipped, error: null };
}
