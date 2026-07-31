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
