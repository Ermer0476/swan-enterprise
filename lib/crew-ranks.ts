// Shared reporter position/rank lists — used wherever a report form asks
// "who reported" (Incident, Near Miss/HOR). Split by department: vessel
// (SHIPBOARD) reporters only see ship ranks; everyone else (office) only
// sees office positions — the two lists never mix on either side.
export const SHIP_POSITIONS = [
  "Master",
  "C/Off",
  "2/Off",
  "3/Off",
  "C/Engr",
  "2/Engr",
  "3/Engr",
  "4/Engr",
  "AB",
  "Olr",
  "OS",
  "Wiper",
  "C/Ck",
  "M/M",
  "Cadet",
] as const;

export const OFFICE_POSITIONS = [
  "Marine Supt",
  "Supt In-charge",
  "DPA",
  "Marine Manager",
  "Technical Manager",
] as const;

export const REPORTER_POSITIONS = [...SHIP_POSITIONS, ...OFFICE_POSITIONS] as const;

/** Department-appropriate position list for the reporter-position dropdown. */
export function positionsFor(department: string): readonly string[] {
  return department === "SHIPBOARD" ? SHIP_POSITIONS : OFFICE_POSITIONS;
}

/**
 * Display label per code — the app's ONE rank vocabulary, with a long form.
 *
 * User.rank holds long-form free text ("Chief Engineer") while everything else
 * stores codes ("C/Engr"). This map is the bridge, and it is a bridge in ONE
 * direction on purpose: code is canonical, label is presentation. Changing what
 * we show for a code is a change to THIS MAP AND NOTHING ELSE — no stored value
 * moves, no migration runs. That property is the entire reason the vocabulary
 * is not a database table.
 *
 * Typed `Record<string, string>` rather than keyed on SHIP_POSITIONS: its one
 * job is to translate values that may predate the list (User.rank's long forms
 * do exactly that), so it must accept a key the array does not contain.
 */
export const RANK_LABELS: Record<string, string> = {
  Master: "Master",
  "C/Off": "Chief Officer",
  "2/Off": "Second Officer",
  "3/Off": "Third Officer",
  "C/Engr": "Chief Engineer",
  "2/Engr": "Second Engineer",
  "3/Engr": "Third Engineer",
  "4/Engr": "Fourth Engineer",
  AB: "Able Seafarer",
  Olr: "Oiler",
  OS: "Ordinary Seafarer",
  Wiper: "Wiper",
  "C/Ck": "Chief Cook",
  "M/M": "Motorman",
  Cadet: "Cadet",
};

/**
 * The long form for a rank code.
 *
 * The `?? code` fallback is deliberate and load-bearing: User.rank still holds
 * un-normalised long-form text ("Chief Engineer"), and passing it through
 * unchanged is what lets User Management keep rendering exactly what it rendered
 * yesterday. A legacy value renders as itself rather than as blank.
 */
export function rankLabel(code: string): string {
  return RANK_LABELS[code] ?? code;
}
