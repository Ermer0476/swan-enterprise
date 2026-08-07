import type { VesselFormValues } from "@/components/vessels/vessel-form";

/** Fields the parser can fill on the vessel form. Same string-typed shape as
 * VesselFormValues so a successful parse can be spread straight into it. */
export type ParsedVesselFields = Partial<
  Pick<
    VesselFormValues,
    | "name"
    | "callSign"
    | "officialNumber"
    | "imo"
    | "flag"
    | "portOfRegistry"
    | "loa"
    | "lbp"
    | "grossTonnage"
    | "netTonnage"
    | "deadweight"
    | "breadth"
    | "depth"
    | "draft"
    | "capacityCbm"
    | "mainEngine"
    | "serviceSpeed"
    | "navigationArea"
    | "classNotation"
    | "classificationSociety"
    | "mmsi"
    | "satPhone"
    | "registeredOwner"
    | "ownerAddress"
    | "builder"
    | "charterer"
    | "keelLaidDate"
    | "launchingDate"
    | "deliveryDate"
    | "totalComplement"
    | "vesselEmail"
  >
>;

// Ship's Particulars sheets vary a lot between owner companies — some use
// "LABEL : value" on one line, others a numbered list with wide-column
// spacing instead of colons ("7   Kind of Ship   Liquefied Gases Carrier"),
// and the wording for the same concept differs too ("Keel Laid" vs "DATE
// KEEL LAID", "Name of Ship" vs "SHIP'S NAME"). Rather than anchor to one
// document's exact labels, this parses line-by-line into generic
// (label, value) pairs, then classifies each label against a synonym list
// per field — so a new template mostly "just works" as long as its labels
// are recognizable words, without needing a rewrite per document style.

type FieldKey = keyof ParsedVesselFields;

// A leading item number, matched separately so it never counts as part of
// either delimiter search below ("27   Cargo Tank Capacity ...").
const LEADING_NUMBER = /^\s*\d{1,3}[.)]?\s+/;

function looksLikeNumberedList(text: string): boolean {
  const numberedLines = text.split(/\r?\n/).filter((l) => /^\s*\d{1,3}\s+\S/.test(l));
  return numberedLines.length >= 5;
}

// A scanned Ship's Particulars sheet run through OCR often garbles the
// colon in "LABEL : value" — misread as "=", "~", ">", a stray digit, or
// dropped entirely — depending on scan quality. These are the delimiter
// characters clean enough on their own to trust regardless of context.
const DELIMITER_CHARS = /[:=~>;]/;

/** Finds where a line's label ends and its value begins, trying — in order
 * of how much they can be trusted on their own — a delimiter character, a
 * wide whitespace gap (numbered-list documents only), a lone period or
 * hyphen surrounded by spaces (other common OCR misreads of ":"), or a
 * value that looks numeric ("LABEL 123..." with no punctuation at all).
 * The last three are only accepted if the resulting label actually matches
 * a known field — tried earliest-candidate-first, falling through to a
 * later one if an earlier candidate's label doesn't match anything —
 * otherwise a wrapped continuation line that happens to contain a stray
 * space-digit pair (an address with a house/floor number, say) would get
 * sliced into a bogus pair instead of properly continuing the previous
 * field's value. */
function findBoundary(body: string, numberedMode: boolean): number | null {
  const strong: number[] = [];
  const delim = DELIMITER_CHARS.exec(body);
  if (delim) strong.push(delim.index);
  if (numberedMode) {
    const gap = /\s{2,}/.exec(body);
    if (gap) strong.push(gap.index);
  }
  if (strong.length > 0) return Math.min(...strong);

  const weak: number[] = [];
  const numeric = /\s(?=[+\d])/.exec(body);
  if (numeric) weak.push(numeric.index);
  const lonePeriod = /\s\.\s/.exec(body);
  if (lonePeriod) weak.push(lonePeriod.index);
  const loneHyphen = /\s-\s/.exec(body);
  if (loneHyphen) weak.push(loneHyphen.index);

  for (const idx of weak.sort((a, b) => a - b)) {
    const label = body.slice(0, idx).trim();
    if (matchesAnySynonym(label)) return idx;
  }
  return null;
}

function matchesAnySynonym(label: string): boolean {
  return (Object.keys(SYNONYMS) as FieldKey[]).some((key) => SYNONYMS[key]!.some((p) => p.test(label)));
}

/** Last-resort match for a line with no delimiter of any kind between its
 * label and value (a scan clean enough that the words are legible but the
 * separating punctuation is missing outright, not just misread) — tries
 * each field's synonym patterns directly against the start of the line.
 * Requires the character right after the match to not be a letter, so a
 * deliberately partial pattern (officialNumber's "/^OFFI/i", matched so a
 * typo like "Offical" still counts) can't cut the label off mid-word and
 * leave its own tail ("cial Number") stuck onto the front of the value. */
function matchKnownLabelPrefix(body: string): { label: string; value: string } | null {
  for (const key of Object.keys(SYNONYMS) as FieldKey[]) {
    for (const pattern of SYNONYMS[key]!) {
      const re = new RegExp(pattern.source.replace(/\$$/, ""), pattern.flags);
      const m = re.exec(body);
      if (!m || m.index !== 0) continue;
      const end = m.index + m[0].length;
      const nextChar = body[end];
      if (nextChar && /[A-Za-z]/.test(nextChar)) continue;
      const value = body.slice(end).replace(/^[\s:=~>|;.-]+/, "").trim();
      if (value) return { label: m[0], value };
    }
  }
  return null;
}

/** Splits the document into (label, value) pairs in document order — see
 * findBoundary and matchKnownLabelPrefix for how a line's delimiter (or
 * lack of one) is handled. A line matching neither is treated as a
 * continuation of the previous pair's value — e.g. a multi-line address or
 * class notation string that wraps without repeating a label. */
function extractFieldPairs(text: string): { label: string; value: string }[] {
  const numberedMode = looksLikeNumberedList(text);
  const pairs: { label: string; value: string }[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+$/, "");
    if (!line.trim()) continue;

    const numberMatch = LEADING_NUMBER.exec(line);
    const stripped = numberMatch ? line.slice(numberMatch[0].length) : line.replace(/^\s+/, "");
    // A stray OCR artifact (a stand-alone "|" from a table rule/column edge,
    // say) at the very start of a line would otherwise register as the
    // "delimiter" itself, leaving an empty label and losing the whole line
    // to a continuation-append onto whatever came before it.
    const body = stripped.replace(/^[^A-Za-z0-9]+/, "");

    const boundary = findBoundary(body, numberedMode);
    if (boundary !== null) {
      const label = body.slice(0, boundary).trim();
      const value = body.slice(boundary).replace(/^[\s:=~>|;.-]+/, "").trim();
      if (label && label.length <= 80 && value) {
        pairs.push({ label, value });
        continue;
      }
    }

    const known = matchKnownLabelPrefix(body);
    if (known) {
      pairs.push(known);
      continue;
    }

    if (pairs.length > 0) {
      pairs[pairs.length - 1]!.value += " " + line.trim();
    }
  }
  return pairs;
}

// Regexes are matched against a whole trimmed label (not a substring search
// of the full line), so e.g. anchoring "draft" with ^ keeps "Service Speed
// at Loaded Draft" from being misread as the draft field.
const SYNONYMS: Partial<Record<FieldKey, RegExp[]>> = {
  name: [/SHIP.?S\s+NAME/i, /^NAME\s+OF\s+SHIP/i],
  callSign: [/CALL\s+SIGN/i],
  // "OFFICIAL NUMBER", "Offical Number" (typo), "Official No." — anchoring
  // on just the "Offi" prefix covers the "Number"/"No."/typo variants
  // without needing to enumerate them.
  officialNumber: [/^OFFI/i],
  // "IMO NUMBER", "IMO No." — same reasoning as officialNumber above.
  imo: [/^IMO\b/i],
  flag: [/NATIONALITY/i],
  portOfRegistry: [/PORT\s+OF\s+REGISTRY/i],
  loa: [/^LOA$/i, /LENGTH\s*\(?\s*L\.?\s*O\.?\s*A\.?/i, /LENGTH\s+OVERALL/i],
  lbp: [/^LBP$/i, /LENGTH.*BETWEEN\s+PERPENDICULAR/i],
  grossTonnage: [/^GRT$/i, /GROSS.*TONNAGE/i],
  netTonnage: [/^NRT$/i, /NET.*TONNAGE/i],
  deadweight: [/DEAD\s*WEIGHT/i],
  breadth: [/BREADTH/i],
  depth: [/DEPTH/i],
  draft: [/^(SUMMER\s+)?DRAFT\b/i],
  capacityCbm: [/CARGO\s+TANK\s+CAPACITY/i, /^CARGO\s+TANKS?\b/i],
  // Anchored (not a bare /ENGINE/i) so it doesn't also catch "Generator
  // Engine" or "Auxiliary Engine" rows elsewhere on the same sheet.
  mainEngine: [/MAIN\s+ENGINE/i, /^ENGINE\b/i],
  serviceSpeed: [/SERVICE\s+SPEED/i, /SEA\s+SPEED/i],
  navigationArea: [/NAVIGATION\s+AREA/i, /SERVICE\s+AREA/i],
  classNotation: [/CLASS\s+NOTATION/i, /^CLASSIFICATION\b/i],
  mmsi: [/MMSI/i, /DSC\s+ID\s+NUMBER/i],
  satPhone: [/TELEPHONE\s+NUMBER\s*\(?V-?SAT\)?/i, /SATELLITE\s*\(?V-?SAT\)?/i, /^V-?SAT\b/i],
  registeredOwner: [/REGISTERED\s+OWNER/i, /^OWNER$/i],
  ownerAddress: [/OWNERS?.?\s*ADDRESS/i, /^ADDRESS$/i],
  builder: [/BUILDER/i],
  charterer: [/CHARTERER/i, /COMMERCIAL.*OPERATOR/i],
  keelLaidDate: [/KEEL\s+LAID/i],
  // "Launching" and "Launched" both describe the same event.
  launchingDate: [/^LAUNCH/i],
  deliveryDate: [/^DELIVERY/i],
  totalComplement: [/(GRAND\s+)?TOTAL\s+COMPLEMENT/i],
  vesselEmail: [/E-?MAIL/i],
};

/** Assigns each (label, value) pair to the first field whose synonym list
 * matches — first pair to match a given field wins, so e.g. a document
 * listing several "Owner" rows for co-owners keeps only the first (the
 * primary owner), matching the single-owner shape of the vessel record. */
function classifyFieldPairs(pairs: { label: string; value: string }[]): Partial<Record<FieldKey, string>> {
  const result: Partial<Record<FieldKey, string>> = {};
  for (const { label, value } of pairs) {
    if (!value.trim()) continue;
    for (const key of Object.keys(SYNONYMS) as FieldKey[]) {
      if (key in result) continue;
      if (SYNONYMS[key]!.some((p) => p.test(label))) {
        result[key] = value;
        break;
      }
    }
  }
  return result;
}

function cleanText(s: string): string {
  return s.replace(/\s+/g, " ").replace(/[|]/g, "").trim();
}

function toNumberString(s: string): string {
  const cleaned = s.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return cleaned ? cleaned[0] : "";
}

function toIntString(s: string): string {
  // Some sheets space-group large numbers ("MMSI No. : 356 028 000") —
  // collapse whitespace first so the digits aren't cut off at the first gap.
  const cleaned = s.replace(/\s+/g, "").match(/\d+/);
  return cleaned ? cleaned[0] : "";
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

const DEMONYM_TO_COUNTRY: Record<string, string> = {
  panamanian: "Panama",
  liberian: "Liberia",
  "marshall islands": "Marshall Islands",
  marshallese: "Marshall Islands",
  singaporean: "Singapore",
  malaysian: "Malaysia",
  filipino: "Philippines",
  bahamian: "Bahamas",
  maltese: "Malta",
  "hong kong": "Hong Kong",
};

function normalizeFlag(s: string): string {
  const key = s.trim().toLowerCase();
  return DEMONYM_TO_COUNTRY[key] ?? titleCase(s);
}

const CLASS_SOCIETY_NAMES: Record<string, string> = {
  NK: "NK (Nippon Kaiji Kyokai)",
  ABS: "ABS (American Bureau of Shipping)",
  DNV: "DNV",
  LR: "LR (Lloyd's Register)",
  BV: "BV (Bureau Veritas)",
  CCS: "CCS (China Classification Society)",
  KR: "KR (Korean Register)",
  RINA: "RINA",
  IRS: "IRS (Indian Register of Shipping)",
  RS: "RS (Russian Maritime Register)",
};

function splitClassNotation(raw: string): { classificationSociety?: string; classNotation: string } {
  const m = /^([A-Z]{2,5})\b\s*(.*)$/.exec(raw);
  if (m && CLASS_SOCIETY_NAMES[m[1]!]) {
    return { classificationSociety: CLASS_SOCIETY_NAMES[m[1]!], classNotation: m[2]!.trim() };
  }
  return { classNotation: raw };
}

function extractEmail(s: string): string | undefined {
  const m = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/.exec(s);
  return m ? m[0] : undefined;
}

function stripTrailingParen(s: string): string {
  return s.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/** "13th DECEMBER 2021 <any trailing OCR noise>" -> "2021-12-13", or
 * undefined if unparseable. Built from an explicit day/month-name/year
 * regex — rather than handing the string to `Date` — for two reasons: it
 * ignores anything after the year (OCR noise from a nearby stamp/signature),
 * and it sidesteps `Date`/`toISOString()` silently shifting the date back a
 * day in any timezone ahead of UTC (local midnight -> earlier UTC date). */
function parseLooseDate(s: string): string | undefined {
  const cleaned = s.replace(/(\d+)(st|nd|rd|th)/gi, "$1");
  // Separator between day/month/year is a space OR a hyphen ("13 December
  // 2021" as well as "10-Jul-13"), and the year may be 2 or 4 digits.
  const m = /(\d{1,2})[\s-]+([A-Za-z]+)\.?[\s-]+(\d{2,4})/.exec(cleaned);
  if (!m) return undefined;
  const day = Number(m[1]);
  const token = m[2]!.toLowerCase();
  // Accept abbreviations ("Sep", "Jan") as well as full names — at least 3
  // letters so it can't match more than one month.
  const monthIndex = token.length >= 3 ? MONTH_NAMES.findIndex((name) => name.startsWith(token)) : -1;
  let year = Number(m[3]);
  if (m[3]!.length <= 2) year += year <= 50 ? 2000 : 1900;
  if (monthIndex === -1 || day < 1 || day > 31) return undefined;
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Parses a "Ship's Particulars" sheet (already extracted to plain text, from
 * either a .docx via mammoth or OCR of a scanned .pdf) into vessel form
 * field values. Returns only the fields it actually found — an unrecognized
 * or garbled document just yields fewer fields, never wrong ones landing in
 * the wrong slot, since every value is bounded by the label that follows it. */
export function parseShipsParticulars(rawText: string): { fields: ParsedVesselFields; foundCount: number } {
  const raw = classifyFieldPairs(extractFieldPairs(rawText));
  const fields: ParsedVesselFields = {};
  let foundCount = 0;

  const set = <K extends keyof ParsedVesselFields>(key: K, value: ParsedVesselFields[K] | undefined) => {
    if (value === undefined || value === "") return;
    fields[key] = value;
    foundCount += 1;
  };

  if (raw.name) set("name", titleCase(cleanText(raw.name)));
  if (raw.callSign) set("callSign", cleanText(raw.callSign));
  if (raw.officialNumber) set("officialNumber", cleanText(raw.officialNumber));
  if (raw.imo) set("imo", toIntString(raw.imo).slice(0, 7));
  if (raw.flag) set("flag", normalizeFlag(cleanText(raw.flag)));
  if (raw.portOfRegistry) set("portOfRegistry", titleCase(cleanText(raw.portOfRegistry)));
  if (raw.loa) set("loa", toNumberString(raw.loa));
  if (raw.lbp) set("lbp", toNumberString(raw.lbp));
  if (raw.grossTonnage) set("grossTonnage", toNumberString(raw.grossTonnage));
  if (raw.netTonnage) set("netTonnage", toNumberString(raw.netTonnage));
  if (raw.deadweight) set("deadweight", toNumberString(raw.deadweight));
  if (raw.breadth) set("breadth", toNumberString(raw.breadth));
  if (raw.depth) set("depth", toNumberString(raw.depth));
  if (raw.draft) set("draft", toNumberString(raw.draft));
  if (raw.capacityCbm) set("capacityCbm", toNumberString(raw.capacityCbm));
  if (raw.mainEngine) set("mainEngine", cleanText(raw.mainEngine));
  if (raw.serviceSpeed) set("serviceSpeed", toNumberString(raw.serviceSpeed));
  if (raw.navigationArea) set("navigationArea", titleCase(cleanText(raw.navigationArea)));
  if (raw.classNotation) {
    const { classificationSociety, classNotation } = splitClassNotation(cleanText(raw.classNotation));
    if (classificationSociety) set("classificationSociety", classificationSociety);
    set("classNotation", classNotation);
  }
  if (raw.mmsi) set("mmsi", toIntString(raw.mmsi).slice(0, 9));
  if (raw.satPhone) set("satPhone", stripTrailingParen(cleanText(raw.satPhone)));
  if (raw.registeredOwner) set("registeredOwner", cleanText(raw.registeredOwner));
  if (raw.ownerAddress) set("ownerAddress", cleanText(raw.ownerAddress));
  if (raw.builder) set("builder", cleanText(raw.builder));
  if (raw.charterer) set("charterer", cleanText(raw.charterer));
  if (raw.keelLaidDate) set("keelLaidDate", parseLooseDate(cleanText(raw.keelLaidDate)));
  if (raw.launchingDate) set("launchingDate", parseLooseDate(cleanText(raw.launchingDate)));
  if (raw.deliveryDate) set("deliveryDate", parseLooseDate(cleanText(raw.deliveryDate)));
  if (raw.totalComplement) set("totalComplement", toIntString(raw.totalComplement));
  if (raw.vesselEmail) set("vesselEmail", extractEmail(cleanText(raw.vesselEmail)));

  return { fields, foundCount };
}
