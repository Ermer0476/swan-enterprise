import type { RootCauseCategoryValue } from "@/lib/root-cause";
import { SIRE_OBSERVATION_CATEGORIES } from "./schema";

export type ParsedObservationDraft = {
  chapter: number | null;
  category: (typeof SIRE_OBSERVATION_CATEGORIES)[number] | null;
  viqRef: string | null;
  question: string | null;
  observation: string;
  immediateCause: string | null;
  rootCauseCategory: RootCauseCategoryValue | null;
  // Sub-category has no signal in the source document (it's a finer split
  // than any template captures) — always null from the parser, left for the
  // reviewer to pick, same as the manual Add Observation form.
  rootCauseSubCategory: string | null;
  rootCause: string | null;
  correctiveAction: string | null;
  preventiveMeasure: string | null;
  /** Which "Observation Number" block in the source doc this came from — for
   * display only, so a reviewer can tell two drafts came from the same VIQ
   * item split across multiple respondents (see splitRootCause below). */
  groupLabel: string;
};

const FIELD_LABEL_PATTERN =
  /(Inspector Observation|Immediate Cause|Root Cause|Corrective Actions?|Preventive Measures?)\s*:/gi;

function normalizeFieldKey(label: string): keyof Omit<
  ParsedObservationDraft,
  "chapter" | "category" | "viqRef" | "question" | "rootCauseCategory" | "groupLabel"
> {
  const l = label.toLowerCase();
  if (l.startsWith("inspector")) return "observation";
  if (l.startsWith("immediate")) return "immediateCause";
  if (l.startsWith("root")) return "rootCause";
  if (l.startsWith("corrective")) return "correctiveAction";
  return "preventiveMeasure";
}

/** Slices `text` on each known field label and returns the text between
 * consecutive labels — robust to fields appearing in a different order or
 * being absent, since it doesn't assume a fixed sequence. */
function extractLabeledFields(text: string): Partial<Record<string, string>> {
  const matches: { key: string; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  FIELD_LABEL_PATTERN.lastIndex = 0;
  while ((m = FIELD_LABEL_PATTERN.exec(text))) {
    matches.push({ key: normalizeFieldKey(m[1]!), start: m.index, end: m.index + m[0].length });
  }
  const result: Partial<Record<string, string>> = {};
  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i]!;
    const next = matches[i + 1];
    const value = text.slice(cur.end, next ? next.start : text.length).trim();
    if (value) result[cur.key] = value;
  }
  return result;
}

// Matches the SIRE Draft Response Template's own Root Cause prefix — these
// map 1:1 onto RootCauseCategory (see lib/root-cause.ts ROOT_CAUSE_LABELS),
// which is exactly why this template can be auto-classified at all. The
// separator varies by template/company (hyphen, en dash, em dash, or none),
// so all three dash characters are accepted.
const ROOT_CAUSE_MATCHERS: { category: RootCauseCategoryValue; pattern: RegExp }[] = [
  { category: "PROCESS_METHODS", pattern: /^process\s*\/?\s*methods?\s*[.:]?\s*[-–—]?\s*/i },
  { category: "HUMAN_FACTORS", pattern: /^human\s*factors?\s*[.:]?\s*[-–—]?\s*/i },
  { category: "EQUIPMENT_SOFTWARE", pattern: /^equipment\s*\/?\s*software\s*[.:]?\s*[-–—]?\s*/i },
  { category: "MATERIALS", pattern: /^materials?\s*[.:]?\s*[-–—]?\s*/i },
  { category: "MEASUREMENT_INFORMATION", pattern: /^measurement\s*\/?\s*information\s*[.:]?\s*[-–—]?\s*/i },
  { category: "ENVIRONMENT_WORK_CONDITIONS", pattern: /^environment(?:al)?\s*\/?\s*(?:work\s*conditions?)?\s*[.:]?\s*[-–—]?\s*/i },
  { category: "MANAGEMENT_GOVERNANCE", pattern: /^management\s*\/?\s*governance\s*[.:]?\s*[-–—]?\s*/i },
];

function splitRootCause(raw: string | undefined): { category: RootCauseCategoryValue | null; description: string | null } {
  if (!raw) return { category: null, description: null };
  for (const { category, pattern } of ROOT_CAUSE_MATCHERS) {
    if (pattern.test(raw)) {
      const rest = raw.replace(pattern, "").trim();
      return { category, description: rest || null };
    }
  }
  return { category: null, description: raw };
}

function parseViqHeader(header: string): { chapter: number | null; viqRef: string | null; question: string | null } {
  const trimmed = header.trim();
  if (!trimmed) return { chapter: null, viqRef: null, question: null };
  const m = /^(\d+(?:\.\d+)+)\s*([\s\S]*)$/.exec(trimmed);
  if (!m) return { chapter: null, viqRef: null, question: trimmed || null };
  const viqRef = m[1]!;
  const chapterNo = Number(viqRef.split(".")[0]);
  const chapter = chapterNo >= 1 && chapterNo <= 12 ? chapterNo : null;
  const question = m[2]!.trim() || null;
  return { chapter, viqRef, question };
}

const RESPONSE_MARKER_PATTERN = /^[ \t]*(HUMAN|PROCESS|HARDWARE|PHOTOGRAPH)\s*:/gim;
const INSPECTOR_OBSERVATION_PATTERN = /Inspector\s+Observation\s*:/gi;

/**
 * Parses a SIRE Draft Response Template (as plain text extracted from the
 * .docx) into draft observation rows, ready for review before saving.
 *
 * Different companies/templates format this differently — two confirmed
 * variants so far:
 *  1. "Observation Number 1: 3.5.1 <question>" with a HUMAN/PROCESS/HARDWARE
 *     category line before each response.
 *  2. "Observation Number: 3.2.1 <question>" (no running number) with no
 *     category line at all — responses are delimited only by repeated
 *     "Inspector Observation:" labels.
 * Both are handled: the block-start match doesn't require the running
 * number, and response-splitting falls back to "Inspector Observation:"
 * boundaries (category left null, for the reviewer to set) whenever no
 * category line is found in a block.
 *
 * One "Observation Number" block can contain more than one response (e.g. a
 * PROCESS finding immediately followed by a separate HUMAN finding for the
 * same VIQ question) — each becomes its own draft row, all sharing that
 * block's VIQ ref/question/chapter.
 */
export function parseSireDraftResponse(rawText: string): ParsedObservationDraft[] {
  const text = rawText.replace(/\r\n/g, "\n");
  const blockPattern = /Observation\s+Number\s*\d*\s*:?\s*/gi;

  const blockStarts: { groupLabel: string; index: number; markerEnd: number }[] = [];
  let bm: RegExpExecArray | null;
  while ((bm = blockPattern.exec(text))) {
    blockStarts.push({ groupLabel: `Observation ${blockStarts.length + 1}`, index: bm.index, markerEnd: bm.index + bm[0].length });
  }

  const drafts: ParsedObservationDraft[] = [];

  for (let i = 0; i < blockStarts.length; i++) {
    const cur = blockStarts[i]!;
    const next = blockStarts[i + 1];
    const chunk = text.slice(cur.markerEnd, next ? next.index : text.length);

    RESPONSE_MARKER_PATTERN.lastIndex = 0;
    const responseStarts: { category: string | null; index: number; lineEnd: number }[] = [];
    let rm: RegExpExecArray | null;
    while ((rm = RESPONSE_MARKER_PATTERN.exec(chunk))) {
      responseStarts.push({
        category: rm[1]!.toUpperCase(),
        index: rm.index,
        // Body starts after the category/role/rating line itself — that
        // line is intentionally discarded, only the category is kept.
        lineEnd: chunk.indexOf("\n", rm.index) === -1 ? chunk.length : chunk.indexOf("\n", rm.index),
      });
    }

    if (responseStarts.length === 0) {
      // No category line anywhere in this block — fall back to splitting on
      // each "Inspector Observation:" occurrence directly; that label is
      // itself the start of the response body, so nothing to skip past.
      INSPECTOR_OBSERVATION_PATTERN.lastIndex = 0;
      let iom: RegExpExecArray | null;
      while ((iom = INSPECTOR_OBSERVATION_PATTERN.exec(chunk))) {
        responseStarts.push({ category: null, index: iom.index, lineEnd: iom.index });
      }
    }
    if (responseStarts.length === 0) continue; // no parseable response in this block — skip rather than guess

    const header = chunk.slice(0, responseStarts[0]!.index);
    const { chapter, viqRef, question } = parseViqHeader(header);

    for (let j = 0; j < responseStarts.length; j++) {
      const respCur = responseStarts[j]!;
      const respNext = responseStarts[j + 1];
      const body = chunk.slice(respCur.lineEnd, respNext ? respNext.index : chunk.length);
      const fields = extractLabeledFields(body);
      const { category: rootCauseCategory, description: rootCause } = splitRootCause(fields.rootCause);

      const observationText = fields.observation ?? "";
      if (!observationText) continue; // nothing to import for this response

      const category =
        respCur.category && SIRE_OBSERVATION_CATEGORIES.includes(respCur.category as (typeof SIRE_OBSERVATION_CATEGORIES)[number])
          ? (respCur.category as (typeof SIRE_OBSERVATION_CATEGORIES)[number])
          : null;

      drafts.push({
        chapter,
        category,
        viqRef,
        question,
        observation: observationText,
        immediateCause: fields.immediateCause ?? null,
        rootCauseCategory,
        rootCauseSubCategory: null,
        rootCause,
        correctiveAction: fields.correctiveAction ?? null,
        preventiveMeasure: fields.preventiveMeasure ?? null,
        groupLabel: responseStarts.length > 1 ? `${cur.groupLabel} (${j + 1} of ${responseStarts.length})` : cur.groupLabel,
      });
    }
  }

  return drafts;
}
