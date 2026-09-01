import * as XLSX from "xlsx";

/**
 * Employee Masterlist import parser (E2).
 *
 * Pure — buffer in, structured rows out, NO database access. Turns an uploaded
 * workbook (typically one produced by the E2 export, but any sheet that
 * carries the masterlist columns works) into a list of candidate users plus a
 * list of rows it could not confidently read.
 *
 * Deliberately conservative, mirroring the procurement inventory parser:
 *
 *  - The header row is found by column LABELS, never by fixed position: the
 *    sheet is scanned for a row that carries at least LAST, FIRST and
 *    EMPLOYEE ID (matched case- and punctuation-insensitively), and every
 *    other column is then located relative to that row's labels. A masterlist
 *    with extra columns, reordered columns, or a title/banner above the header
 *    parses the same.
 *  - A row that cannot be tied to any identity (no last name, no first name,
 *    no employee ID and no email) goes to `flagged` with a reason rather than
 *    being guessed at — the caller shows both lists for review before anything
 *    is written.
 *  - AGE and YEARS OF SERVICE columns, if present, are IGNORED: they are
 *    derived from the birth/hire dates on display and must never be imported
 *    as stored values. The leading "#" column is ignored too.
 *
 * Dates are read with `cellDates`, so a real Excel date cell arrives as a JS
 * Date and is normalised to `YYYY-MM-DD` (UTC); a free-text date is passed
 * through untouched for the commit step's zod coercion to accept or reject
 * per-row. Government IDs and every other field are passed through exactly as
 * typed — normalisation, if any, is the commit step's job, not the parser's.
 */

export type ParsedUserRow = {
  /** 1-based row number within the source sheet, for the reviewer to locate it. */
  rowNo: number;
  lastName: string | null;
  firstName: string | null;
  middleName: string | null;
  initials: string | null;
  gender: string | null;
  employeeId: string | null;
  employmentStatus: string | null;
  designation: string | null;
  birthDate: string | null;
  dateHired: string | null;
  officialAddress: string | null;
  tin: string | null;
  sss: string | null;
  hdmf: string | null;
  philHealth: string | null;
  email: string | null;
};

export type FlaggedUserRow = {
  rowNo: number;
  rawText: string;
  reason: string;
};

export type ImportCounts = {
  /** Non-blank data rows below the header that were examined. */
  total: number;
  parsed: number;
  flagged: number;
};

export type ParseUserWorkbookResult = {
  rows: ParsedUserRow[];
  flagged: FlaggedUserRow[];
  counts: ImportCounts;
  error: string | null;
};

// The masterlist fields, each with the set of header labels that map to it.
// Labels are compared after NORMALISATION (uppercased, every non-alphanumeric
// stripped), so "PHIL-HEALTH", "PHIL HEALTH" and "PhilHealth" all collapse to
// "PHILHEALTH" and match. Order within a field's alias list does not matter;
// the first sheet column whose normalised label is in the list wins.
type FieldKey = Exclude<keyof ParsedUserRow, "rowNo">;

const FIELD_ALIASES: Record<FieldKey, string[]> = {
  lastName: ["LAST", "LASTNAME", "SURNAME", "FAMILYNAME"],
  firstName: ["FIRST", "FIRSTNAME", "GIVENNAME"],
  middleName: ["MIDDLE", "MIDDLENAME"],
  initials: ["INITIALS", "INITIAL"],
  gender: ["GENDER", "SEX"],
  employeeId: ["EMPLOYEEID", "EMPID", "EMPLOYEENO", "EMPLOYEENUMBER", "IDNUMBER", "STAFFID"],
  employmentStatus: ["EMPLOYMENTSTATUS", "STATUS"],
  designation: ["DESIGNATION", "POSITION", "JOBTITLE"],
  birthDate: ["BIRTHDATE", "DATEOFBIRTH", "DOB", "BIRTHDAY"],
  dateHired: ["DATEHIRED", "HIREDATE", "DATEEMPLOYED", "DATEOFHIRE"],
  officialAddress: ["OFFICIALADDRESS", "ADDRESS", "HOMEADDRESS"],
  tin: ["TIN", "TINNO", "TINNUMBER"],
  sss: ["SSS", "SSSNO", "SSSNUMBER"],
  hdmf: ["HDMF", "PAGIBIG", "HDMFPAGIBIG", "PAGIBIGNO"],
  philHealth: ["PHILHEALTH", "PHIC", "PHILHEALTHNO"],
  email: ["EMAIL", "EMAILADDRESS", "EMAILADD"],
};

/** Uppercase and strip every non-alphanumeric character. */
function normLabel(v: unknown): string {
  return String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function cellText(row: unknown[], idx: number | undefined): string | null {
  if (idx === undefined || idx < 0) return null;
  const v = row[idx];
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return isoFromDate(v);
  const s = String(v).trim();
  return s === "" ? null : s;
}

/** A JS Date (from a real Excel date cell) rendered as bare UTC `YYYY-MM-DD`. */
function isoFromDate(d: Date): string {
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

// Builds label→columnIndex for a candidate header row. First column that
// matches a field's alias set claims that field; a later duplicate column is
// left for other fields and otherwise ignored.
function mapHeader(row: unknown[]): Partial<Record<FieldKey, number>> {
  const map: Partial<Record<FieldKey, number>> = {};
  row.forEach((cell, idx) => {
    const label = normLabel(cell);
    if (!label) return;
    for (const key of Object.keys(FIELD_ALIASES) as FieldKey[]) {
      if (map[key] !== undefined) continue;
      if (FIELD_ALIASES[key].includes(label)) {
        map[key] = idx;
        return;
      }
    }
  });
  return map;
}

// A row is the header once it carries the three anchor labels. Requiring all
// three (not just one) keeps a stray "FIRST AID" banner or an "ADDRESS" line
// in a title block from being mistaken for the header.
function isHeaderRow(map: Partial<Record<FieldKey, number>>): boolean {
  return map.lastName !== undefined && map.firstName !== undefined && map.employeeId !== undefined;
}

export function parseUserImportWorkbook(buffer: Buffer): ParseUserWorkbookResult {
  const empty: ImportCounts = { total: 0, parsed: 0, flagged: 0 };

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  } catch {
    return {
      rows: [],
      flagged: [],
      counts: empty,
      error: "Could not read this file — it may be corrupted or not a valid spreadsheet",
    };
  }

  // Find the first sheet that carries a masterlist header row, and parse only
  // that one. A masterlist is a single table; scanning every sheet would risk
  // folding an unrelated leftover tab into the same import.
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as unknown[][];

    let headerIdx = -1;
    let header: Partial<Record<FieldKey, number>> = {};
    for (let i = 0; i < raw.length; i++) {
      const map = mapHeader(raw[i] ?? []);
      if (isHeaderRow(map)) {
        headerIdx = i;
        header = map;
        break;
      }
    }
    if (headerIdx === -1) continue;

    const rows: ParsedUserRow[] = [];
    const flagged: FlaggedUserRow[] = [];
    let total = 0;

    for (let i = headerIdx + 1; i < raw.length; i++) {
      const r = raw[i] ?? [];
      const rowNo = i + 1;

      const get = (key: FieldKey): string | null => cellText(r, header[key]);

      const candidate: ParsedUserRow = {
        rowNo,
        lastName: get("lastName"),
        firstName: get("firstName"),
        middleName: get("middleName"),
        initials: get("initials"),
        gender: get("gender"),
        employeeId: get("employeeId"),
        employmentStatus: get("employmentStatus"),
        designation: get("designation"),
        birthDate: get("birthDate"),
        dateHired: get("dateHired"),
        officialAddress: get("officialAddress"),
        tin: get("tin"),
        sss: get("sss"),
        hdmf: get("hdmf"),
        philHealth: get("philHealth"),
        email: get("email"),
      };

      // A row with nothing in any mapped column is a blank separator — skip it
      // silently, don't count it and don't flag it.
      const anyValue = (Object.keys(candidate) as (keyof ParsedUserRow)[]).some(
        (k) => k !== "rowNo" && candidate[k] !== null,
      );
      if (!anyValue) continue;

      // A repeated header (a page break that reprints the column titles) — skip
      // it rather than flag it as an unreadable person.
      if (isHeaderRow(mapHeader(r))) continue;

      total++;

      // No identity at all → cannot match an existing account nor create one.
      const hasIdentity =
        candidate.lastName !== null ||
        candidate.firstName !== null ||
        candidate.employeeId !== null ||
        candidate.email !== null;

      if (!hasIdentity) {
        flagged.push({
          rowNo,
          rawText: JSON.stringify(r),
          reason: "No last name, first name, employee ID or email — nothing to identify this person",
        });
        continue;
      }

      rows.push(candidate);
    }

    return { rows, flagged, counts: { total, parsed: rows.length, flagged: flagged.length }, error: null };
  }

  return {
    rows: [],
    flagged: [],
    counts: empty,
    error:
      'No masterlist table was recognised — looked for a header row with LAST, FIRST and EMPLOYEE ID columns on every sheet.',
  };
}
