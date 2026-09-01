export type ParsedHazardRowDraft = {
  phase: string | null;
  consequence: string;
  causes: string;
  severity: number;
  likelihood: number;
  existingControls: string;
  additionalControls: string | null;
  resLikelihood: number | null;
  responsible: string | null;
  isNew: boolean;
  /** The document's own row label ("1", "★M-3", …) — display only, so a
   * reviewer can cross-check against the source file. */
  sourceRowLabel: string;
};

const HEADER_START = /^no\.?$/i;
const RESPONSIBLE_LABEL = /^responsible$/i;
// A row's own label cell: a bare number ("1") or a short new-hazard code
// ("★M-3") — short and code-shaped, unlike every other cell in the table
// which is a sentence. Used to tell a real data row apart from a merged
// full-width note row (e.g. a "RESCOPED — …" callout above row 1).
const ROW_LABEL_PATTERN = /^★?\s*[A-Za-z0-9.-]{1,10}$/;
const DASH_PLACEHOLDER = /^[—–-]$/;

export type ParsedRaMetadata = {
  title: string | null;
  smsProcedureRefs: string | null;
  riskMatrixRef: string | null;
  checklistsRequired: string | null;
};

// The RC-012 header block always puts a metadata label in its own cell —
// the value that follows is a separate cell, never colon-merged into the
// label the way the top block (Form No./Rev./RA Ref./…) sometimes is.
// Confirmed against three real revised-RA exports with different label
// wording ("Operation" vs "Operation Type", "SMS Procedure" vs "SMS
// Procedures") — the label-then-next-cell shape held in all three.
const METADATA_LABELS: { key: keyof ParsedRaMetadata; pattern: RegExp }[] = [
  { key: "title", pattern: /^operation(?:\s*type)?$/i },
  { key: "smsProcedureRefs", pattern: /^sms\s*procedures?$/i },
  { key: "riskMatrixRef", pattern: /^risk\s*matrix$/i },
  { key: "checklistsRequired", pattern: /^checklists?\s*required$/i },
];
const ANY_METADATA_LABEL = new RegExp(`(${METADATA_LABELS.map((l) => l.pattern.source).join("|")})`, "i");

/** Best-effort extraction of the RC-012 header fields that map directly
 * onto the New Risk Assessment form — offered as an editable prefill, never
 * saved without the office seeing it first. A label whose value cell is
 * genuinely blank (filtered out along with every other blank line) would
 * otherwise silently pick up the NEXT label's value instead — guarded by
 * refusing to use a "value" that is itself a recognized label. */
function extractRaMetadata(headerCells: string[]): ParsedRaMetadata {
  const result: ParsedRaMetadata = { title: null, smsProcedureRefs: null, riskMatrixRef: null, checklistsRequired: null };
  for (const { key, pattern } of METADATA_LABELS) {
    const idx = headerCells.findIndex((c) => pattern.test(c.trim()));
    if (idx === -1) continue;
    const next = headerCells[idx + 1];
    if (!next || ANY_METADATA_LABEL.test(next.trim())) continue;
    result[key] = next.trim();
  }
  return result;
}

function cleanCell(raw: string | undefined): string | null {
  const v = raw?.trim();
  if (!v || DASH_PLACEHOLDER.test(v)) return null;
  return v;
}

function toLevel(raw: string | undefined): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

function mapGroupToRow(group: string[]): ParsedHazardRowDraft | null {
  // Fixed column order of the RC-012 revised-RA Word template (as produced
  // by the swan-ra-review skill): No | Consequence | Causes | S | L | RF |
  // RiskLevel | Existing Controls | Additional Controls | Res.S | Res.L |
  // Res.RF | Res.Risk | Responsible. RF/RiskLevel/Res.S/Res.RF/Res.Risk are
  // all derived values the app recomputes itself (computeRF/riskBand), so
  // they're read past rather than trusted from the file.
  const [no, consequence, causes, sRaw, lRaw, , , existingControlsRaw, additionalControlsRaw, , resLRaw, , , responsibleRaw] = group;

  const severity = toLevel(sRaw);
  const likelihood = toLevel(lRaw);
  // Severity/Likelihood failing to parse as 1-5 is the strongest signal that
  // this group is misaligned (a blank cell earlier in the row silently
  // shifted every field after it) — safer to drop the row than save
  // garbage into a safety document.
  if (severity === null || likelihood === null) return null;

  const consequenceText = consequence?.trim() ?? "";
  const causesText = causes?.trim() ?? "";
  const existingControlsText = cleanCell(existingControlsRaw) ?? "";
  if (consequenceText.length < 3 || causesText.length < 3 || existingControlsText.length < 3) return null;

  return {
    phase: null,
    consequence: consequenceText,
    causes: causesText,
    severity,
    likelihood,
    existingControls: existingControlsText,
    additionalControls: cleanCell(additionalControlsRaw),
    resLikelihood: toLevel(resLRaw),
    responsible: cleanCell(responsibleRaw),
    isNew: (no?.trim() ?? "").startsWith("★"),
    sourceRowLabel: no?.trim() ?? "",
  };
}

/**
 * Parses an RC-012 revised Risk Assessment Word document (as plain text via
 * mammoth) into draft hazard rows, ready for office review before saving.
 *
 * Mammoth's extractRawText emits one table cell per non-blank line, in
 * row-major document order, separated by blank lines — so filtering blanks
 * yields a flat array of cells: the 14-cell header, then each data row's 14
 * cells back to back, with the odd merged full-width note row (a "RESCOPED
 * — …" callout, say) collapsing to a single cell of its own.
 *
 * The header's own cell count is measured at parse time (No. → Responsible)
 * rather than hardcoded, so a template with an extra/missing column fails
 * cleanly (returns no rows) instead of silently misreading every row after
 * it. This is intentionally scoped to the one template swan-ra-review
 * generates — a different company's RA export would need its own parser,
 * same as the SIRE Draft Response Template parser only understands its one
 * template's shape.
 */
export function parseRaHazardTable(
  rawText: string,
): { rows: ParsedHazardRowDraft[]; skipped: number; metadata: ParsedRaMetadata } {
  const cells = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const emptyMetadata: ParsedRaMetadata = { title: null, smsProcedureRefs: null, riskMatrixRef: null, checklistsRequired: null };

  const headerStart = cells.findIndex((c) => HEADER_START.test(c));
  if (headerStart === -1) return { rows: [], skipped: 0, metadata: emptyMetadata };

  // The document header — everything before the hazard table's own "No."
  // column heading — is where the RC-012 metadata block lives.
  const metadata = extractRaMetadata(cells.slice(0, headerStart));

  const respIdx = cells.findIndex((c, i) => i > headerStart && i < headerStart + 20 && RESPONSIBLE_LABEL.test(c));
  if (respIdx === -1) return { rows: [], skipped: 0, metadata };

  const headerLen = respIdx - headerStart + 1;
  if (headerLen < 10 || headerLen > 20) return { rows: [], skipped: 0, metadata };

  // Skip any note row(s) — a phase banner ("PHASE 2 — …") or a "▸
  // MERGED/NEW/RETAINED …" provenance callout, both full-width merged rows
  // that mammoth collapses to a single non-blank line each (never a full
  // headerLen-cell group). These appear between the header and the first
  // hazard row, AND between almost every subsequent pair of hazard rows —
  // sometimes two in a row (a phase banner immediately followed by a note)
  // — so this must run again after every group, not just once at the top.
  const skipNoteRows = (from: number): number => {
    let i = from;
    while (i < cells.length && !ROW_LABEL_PATTERN.test(cells[i]!)) i++;
    return i;
  };

  let cursor = skipNoteRows(respIdx + 1);

  const rows: ParsedHazardRowDraft[] = [];
  let skipped = 0;
  while (cursor + headerLen <= cells.length && ROW_LABEL_PATTERN.test(cells[cursor]!)) {
    const group = cells.slice(cursor, cursor + headerLen);
    cursor += headerLen;
    const row = mapGroupToRow(group);
    if (row) rows.push(row);
    else skipped++;
    cursor = skipNoteRows(cursor);
  }

  return { rows, skipped, metadata };
}
