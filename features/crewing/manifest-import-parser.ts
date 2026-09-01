import * as XLSX from "xlsx";
import { SHIP_POSITIONS, RANK_LABELS } from "@/lib/crew-ranks";

/**
 * Crew Manifest import parser (Crewing).
 *
 * Pure — buffer in, structured rows out, NO database access. Turns an uploaded
 * per-vessel crew manifest (the SWAN/AMN "Crew List" spreadsheet) into a list
 * of candidate embarkations plus the rows it could not confidently read, and
 * the vessel the sheet names in its banner.
 *
 * It mirrors features/users/masterlist-import-parser.ts deliberately:
 *
 *  - The header row is found by column LABELS, never by fixed position: the
 *    sheet is scanned for a row that carries the manifest's anchor columns
 *    (CREW ID NO., CREW NAME, RANK, DATE EMBARKED, PORT OF EMBARKATION),
 *    matched case- and punctuation-insensitively. A banner, a title block or a
 *    reprinted header above/among the data does not derail it.
 *  - A row that cannot be tied to a man (no crew ID AND no name) goes to
 *    `flagged` with a reason rather than being guessed at.
 *  - The certificate/document columns (SIRB, PASSPORT, LICENSE, STCW, DUE OFF,
 *    DATE PROMOTED) are OUT OF SCOPE — the crew biodata tier is a future batch.
 *    They are parsed-past and never extracted or stored.
 *
 * ── THE VESSEL BANNER ──
 * A per-vessel manifest names its ship on a line of its own, above the table
 * (`Vessel: LPG/C AMAURY NEYRAND`). It is read here as a hint only; the commit
 * step resolves it to a company-scoped Vessel by name, and the UI always lets
 * the office confirm or override the ship before anything is written.
 *
 * ── THE NAME COLUMN ──
 * The manifest packs the whole name and the age into one cell in the
 * surname-first form `SURNAME, FIRST MIDDLE (AGE)`. The trailing `(AGE)` is
 * stripped and discarded (age is sensitive and derived from the date of birth
 * elsewhere — never imported as a stored value), the surname is taken from
 * before the first comma, and the remainder splits into a first name and a
 * middle name. A cell with no comma yields a surname only; the commit step
 * decides whether that is enough (it is, to reuse an existing man by crew ID;
 * it is not, to create a new one).
 *
 * Dates are read with `cellDates`, so a real Excel date cell arrives as a JS
 * Date and is normalised to bare UTC `YYYY-MM-DD`; a free-text date passes
 * through for the commit step to accept or reject per row.
 */

export type ParsedManifestRow = {
  /** 1-based row number within the source sheet, for the reviewer to locate it. */
  rowNo: number;
  /** CREW ID NO. exactly as written (`26-0080`, `96-394`) — validated at commit. */
  crewCode: string | null;
  lastName: string | null;
  firstName: string | null;
  middleName: string | null;
  /** The RANK cell verbatim (`CHIEF ENGINEER`, `BOSUN`), for display. */
  rank: string | null;
  /** The RANK mapped onto a SHIP_POSITIONS code when it matches, else null. */
  rankCode: string | null;
  /** DATE EMBARKED — `YYYY-MM-DD` from a date cell, or free text passed through. */
  dateEmbarked: string | null;
  /** PORT OF EMBARKATION, free text. */
  signOnPort: string | null;
};

export type FlaggedManifestRow = {
  rowNo: number;
  rawText: string;
  reason: string;
};

export type ManifestImportCounts = {
  /** Non-blank data rows below the header that were examined. */
  total: number;
  parsed: number;
  flagged: number;
};

export type ParseManifestResult = {
  /** The ship named in a `Vessel:` banner, if the sheet carried one. */
  vesselName: string | null;
  rows: ParsedManifestRow[];
  flagged: FlaggedManifestRow[];
  counts: ManifestImportCounts;
  error: string | null;
};

// ─── Rank mapping ────────────────────────────────────────────────────────────
// A normalised label → SHIP_POSITIONS code lookup, built once. Every rank code
// maps to itself, and its long form (RANK_LABELS, e.g. "Chief Engineer") maps
// to the code, plus a small table of the abbreviations and spellings a real
// manifest uses that neither the code nor the label covers. Anything not in the
// table stays raw (rankCode: null) — the module's rank vocabulary is closed, so
// a rank it does not recognise is reported, not invented.

const RANK_ALIASES: Record<string, string> = {
  MASTER: "Master",
  CAPTAIN: "Master",
  CAPT: "Master",
  CHIEFOFFICER: "C/Off",
  CHIEFMATE: "C/Off",
  CHOFF: "C/Off",
  CO: "C/Off",
  SECONDOFFICER: "2/Off",
  SECONDMATE: "2/Off",
  SECOFF: "2/Off",
  THIRDOFFICER: "3/Off",
  THIRDMATE: "3/Off",
  CHIEFENGINEER: "C/Engr",
  CHENGR: "C/Engr",
  CHENG: "C/Engr",
  CE: "C/Engr",
  SECONDENGINEER: "2/Engr",
  SECENGR: "2/Engr",
  THIRDENGINEER: "3/Engr",
  THIRDENGR: "3/Engr",
  FOURTHENGINEER: "4/Engr",
  FOURTHENGR: "4/Engr",
  ABLESEAMAN: "AB",
  ABLESEAFARER: "AB",
  ABLEBODIEDSEAMAN: "AB",
  OILER: "Olr",
  ORDINARYSEAMAN: "OS",
  ORDINARYSEAFARER: "OS",
  WIPER: "Wiper",
  CHIEFCOOK: "C/Ck",
  COOK: "C/Ck",
  MESSMAN: "M/M",
  MOTORMAN: "M/M",
  CADET: "Cadet",
  DECKCADET: "Cadet",
  ENGINECADET: "Cadet",
};

/** Uppercase and strip every non-alphanumeric character. */
function normLabel(v: unknown): string {
  return String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

const RANK_LOOKUP: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const code of SHIP_POSITIONS) m.set(normLabel(code), code);
  for (const [code, label] of Object.entries(RANK_LABELS)) {
    const key = normLabel(label);
    if (key && !m.has(key)) m.set(key, code);
  }
  for (const [alias, code] of Object.entries(RANK_ALIASES)) {
    if (!m.has(alias)) m.set(alias, code);
  }
  return m;
})();

/** The SHIP_POSITIONS code for a raw rank string, or null when unrecognised. */
function mapRank(raw: string | null): string | null {
  if (!raw) return null;
  return RANK_LOOKUP.get(normLabel(raw)) ?? null;
}

// ─── Header location ─────────────────────────────────────────────────────────
// Each manifest field carries the set of NORMALISED labels that map to it, plus
// an optional prefix match for the columns whose header text is variable
// (CREW NAME (AGE); PORT OF EMBARKATION vs PORT). The first sheet column whose
// normalised label matches claims the field.

type FieldKey = "crewCode" | "name" | "rank" | "dateEmbarked" | "signOnPort";

type FieldMatch = { exact: string[]; prefix?: string[] };

const FIELD_MATCH: Record<FieldKey, FieldMatch> = {
  crewCode: { exact: ["CREWIDNO", "CREWID", "CREWIDNUMBER", "CREWNO", "CREWIDNUM"] },
  name: { exact: ["NAME", "CREWNAME"], prefix: ["CREWNAME"] },
  rank: { exact: ["RANK", "RANKRATING", "POSITION", "RATING"] },
  dateEmbarked: { exact: ["DATEEMBARKED", "EMBARKED", "SIGNON", "DATEEMBARK", "DATESIGNON"] },
  signOnPort: { exact: ["PORTOFEMBARKATION", "PORT", "PORTEMBARKATION"], prefix: ["PORTOFEMBARK"] },
};

function matchField(label: string, key: FieldKey): boolean {
  const m = FIELD_MATCH[key];
  if (m.exact.includes(label)) return true;
  if (m.prefix) return m.prefix.some((p) => label.startsWith(p));
  return false;
}

function mapHeader(row: unknown[]): Partial<Record<FieldKey, number>> {
  const map: Partial<Record<FieldKey, number>> = {};
  row.forEach((cell, idx) => {
    const label = normLabel(cell);
    if (!label) return;
    (Object.keys(FIELD_MATCH) as FieldKey[]).forEach((key) => {
      if (map[key] !== undefined) return;
      if (matchField(label, key)) map[key] = idx;
    });
  });
  return map;
}

// The row is the header once it carries ALL FIVE anchors. Requiring every one
// (not just a couple) keeps a stray "PORT" or "RANK" word in a title block from
// being mistaken for the table header.
function isHeaderRow(map: Partial<Record<FieldKey, number>>): boolean {
  return (
    map.crewCode !== undefined &&
    map.name !== undefined &&
    map.rank !== undefined &&
    map.dateEmbarked !== undefined &&
    map.signOnPort !== undefined
  );
}

// ─── Cell + name + vessel helpers ────────────────────────────────────────────

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

/**
 * Splits the manifest's `SURNAME, FIRST MIDDLE (AGE)` name cell.
 *
 * The trailing `(AGE)` — a parenthesised number at the very end — is stripped
 * and discarded first. Then the surname is everything before the first comma,
 * the first name is the first whitespace token after it, and the middle name is
 * whatever remains. With no comma, the whole cell is treated as the surname
 * (first/middle null) — enough to reuse a man by crew ID, and the commit step
 * refuses to CREATE a new man without a first name.
 */
function parseName(raw: string): {
  lastName: string | null;
  firstName: string | null;
  middleName: string | null;
} {
  const cleaned = raw.replace(/\s*\(\s*\d+\s*\)\s*$/, "").trim();
  if (!cleaned) return { lastName: null, firstName: null, middleName: null };

  const comma = cleaned.indexOf(",");
  if (comma === -1) {
    return { lastName: cleaned || null, firstName: null, middleName: null };
  }
  const lastName = cleaned.slice(0, comma).trim() || null;
  const rest = cleaned.slice(comma + 1).trim();
  if (!rest) return { lastName, firstName: null, middleName: null };
  const parts = rest.split(/\s+/);
  const firstName = parts.shift() ?? null;
  const middleName = parts.length ? parts.join(" ") : null;
  return { lastName, firstName, middleName };
}

/**
 * The ship named in a `Vessel:` banner anywhere above the table, if present.
 * The label may be its own cell with the name in the next cell, or the whole
 * thing may sit in one cell (`Vessel: LPG/C AMAURY NEYRAND`). Both are handled;
 * the value is trimmed and returned verbatim (the vessel-type prefix and all),
 * for the commit step to resolve.
 */
function findVesselName(raw: unknown[][], upTo: number): string | null {
  for (let i = 0; i < upTo; i++) {
    const cells = raw[i] ?? [];
    for (let j = 0; j < cells.length; j++) {
      const text = cellText(cells, j);
      if (!text) continue;
      const m = text.match(/vessel\s*:?\s*(.*)$/i);
      if (!m) continue;
      const inline = m[1]?.trim();
      if (inline) return inline;
      // Label alone → the name is the next non-empty cell on the same row.
      for (let k = j + 1; k < cells.length; k++) {
        const next = cellText(cells, k);
        if (next) return next;
      }
    }
  }
  return null;
}

// ─── The parse ───────────────────────────────────────────────────────────────

export function parseCrewManifestWorkbook(buffer: Buffer): ParseManifestResult {
  const empty: ManifestImportCounts = { total: 0, parsed: 0, flagged: 0 };

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  } catch {
    return {
      vesselName: null,
      rows: [],
      flagged: [],
      counts: empty,
      error: "Could not read this file — it may be corrupted or not a valid spreadsheet",
    };
  }

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

    const vesselName = findVesselName(raw, headerIdx);
    const rows: ParsedManifestRow[] = [];
    const flagged: FlaggedManifestRow[] = [];
    let total = 0;

    for (let i = headerIdx + 1; i < raw.length; i++) {
      const r = raw[i] ?? [];
      const rowNo = i + 1;

      const crewCode = cellText(r, header.crewCode);
      const nameCell = cellText(r, header.name);
      const rankCell = cellText(r, header.rank);
      const dateEmbarked = cellText(r, header.dateEmbarked);
      const signOnPort = cellText(r, header.signOnPort);

      // A row with nothing in any mapped column is a blank separator — skip it
      // silently, don't count it and don't flag it.
      if (!crewCode && !nameCell && !rankCell && !dateEmbarked && !signOnPort) continue;

      // A reprinted header (a page break that repeats the column titles) — skip
      // rather than flag it as an unreadable man.
      if (isHeaderRow(mapHeader(r))) continue;

      total++;

      // No crew ID AND no name → nothing to match a man on or create one from.
      if (!crewCode && !nameCell) {
        flagged.push({
          rowNo,
          rawText: JSON.stringify(r),
          reason: "No crew ID and no name — nothing to identify this seafarer",
        });
        continue;
      }

      const { lastName, firstName, middleName } = nameCell
        ? parseName(nameCell)
        : { lastName: null, firstName: null, middleName: null };

      rows.push({
        rowNo,
        crewCode,
        lastName,
        firstName,
        middleName,
        rank: rankCell,
        rankCode: mapRank(rankCell),
        dateEmbarked,
        signOnPort,
      });
    }

    return {
      vesselName,
      rows,
      flagged,
      counts: { total, parsed: rows.length, flagged: flagged.length },
      error: null,
    };
  }

  return {
    vesselName: null,
    rows: [],
    flagged: [],
    counts: empty,
    error:
      "No crew manifest table was recognised — looked for a header row with CREW ID NO., CREW NAME, RANK, DATE EMBARKED and PORT OF EMBARKATION columns on every sheet.",
  };
}
