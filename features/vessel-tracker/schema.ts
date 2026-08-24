import { z } from "zod";

// Field order and labels mirror the fleet's existing "Voyage Input Data"
// Excel sheet (Voyage Analysis BTsolve workbook) as closely as possible —
// vessels already know this form, this is just the same daily entry online.

export const VOYAGE_REPORT_TYPES = ["DEPARTURE", "ARRIVAL", "NOON_AT_SEA", "IN_PORT"] as const;
export type VoyageReportTypeValue = (typeof VOYAGE_REPORT_TYPES)[number];
export const VOYAGE_REPORT_TYPE_LABELS: Record<VoyageReportTypeValue, string> = {
  DEPARTURE: "Departure",
  ARRIVAL: "Arrival",
  NOON_AT_SEA: "Noon Position (at sea)",
  IN_PORT: "While in Port",
};

// No direct Excel column — asked directly, in the same everyday terms a
// deck officer already uses in noon reporting, so the office's Vessel
// Tracker calendar can show the right status icon per day.
export const VESSEL_TRACKER_STATUSES = ["SAILING", "DRIFTING", "SHELTERING", "ANCHORING", "IN_PORT"] as const;
export type VesselTrackerStatusValue = (typeof VESSEL_TRACKER_STATUSES)[number];
export const VESSEL_TRACKER_STATUS_LABELS: Record<VesselTrackerStatusValue, string> = {
  SAILING: "Underway",
  DRIFTING: "Drifting",
  SHELTERING: "Sheltering",
  ANCHORING: "Anchoring",
  IN_PORT: "In Port",
};

export const LADEN_STATES = ["LADEN", "BALLAST"] as const;
export type LadenStateValue = (typeof LADEN_STATES)[number];
export const LADEN_STATE_LABELS: Record<LadenStateValue, string> = {
  LADEN: "Laden",
  BALLAST: "Ballast",
};

export const ENGINE_ORDERS = ["NORMAL_STEAMING", "SLOW_STEAMING", "SUPER_SLOW_STEAMING", "FAST_STEAMING"] as const;
export type EngineOrderValue = (typeof ENGINE_ORDERS)[number];
export const ENGINE_ORDER_LABELS: Record<EngineOrderValue, string> = {
  NORMAL_STEAMING: "Normal Steaming",
  SLOW_STEAMING: "Slow Steaming",
  SUPER_SLOW_STEAMING: "Super Slow Steaming",
  FAST_STEAMING: "Fast Steaming",
};

// Matches the fleet's actual daily "Vessel Tracker" report from
// btsolve.com (While in Port / Noon / Departure / Arrival) — richer than
// the Voyage Input Data Excel rollup above, which turned out to be a
// summary of these full daily reports rather than the primary form itself.
export const BUNKER_GRADES = [
  "HSFO", "LSFO", "HSDO", "LSDO", "HSGO", "LSGO",
  "CYL_OIL", "MELO", "GELO", "FRESH_WATER", "FRESH_WATER_PRODUCTION",
] as const;
export type BunkerGradeValue = (typeof BUNKER_GRADES)[number];

// The entry form no longer collects Fresh Water Production — kept out of
// the crew's daily input, but left in BUNKER_GRADES/BUNKER_GRADE_LABELS
// above so the ~15 already-saved historical rows still resolve a label
// wherever past entries are displayed (voyage log, reports, charts).
export const ENTRY_FORM_BUNKER_GRADES: BunkerGradeValue[] = BUNKER_GRADES.filter(
  (g) => g !== "FRESH_WATER_PRODUCTION",
);

export const BUNKER_GRADE_LABELS: Record<BunkerGradeValue, string> = {
  HSFO: "Fuel Oil — HSFO",
  LSFO: "Fuel Oil — LSFO",
  HSDO: "Diesel Oil — HSDO",
  LSDO: "Diesel Oil — LSDO",
  HSGO: "Marine Gas Oil — HSGO",
  LSGO: "Marine Gas Oil — LSGO",
  CYL_OIL: "Cyl Oil",
  MELO: "MELO",
  GELO: "GELO",
  FRESH_WATER: "Fresh Water",
  FRESH_WATER_PRODUCTION: "Fresh Water Production",
};

// Fuel Oil (HSFO/LSFO) is residual heavy fuel; Diesel Oil (HSDO/LSDO) and
// Marine Gas Oil (HSGO/LSGO) are both distillate fuels typically burned the
// same way for generators/boilers — grouped into one "DO" bucket so the
// existing two-series FO/DO charts and KPI tiles don't need a third series.
const FO_GRADES: BunkerGradeValue[] = ["HSFO", "LSFO"];
const DO_GRADES: BunkerGradeValue[] = ["HSDO", "LSDO", "HSGO", "LSGO"];
// Lube oil grades (Cyl Oil, MELO, GELO) stay separate rather than merged
// into one bucket like FO/DO — they serve different machinery (2-stroke
// cylinders, main engine crankcase, generator engines) with independently
// meaningful consumption rates, so collapsing them would hide which one is
// actually running high. See lubeOilTotals below.

/** Total FO/DO consumed and ROB, derived from the per-grade bunker ledger —
 * replaces the old manually-typed foTotalMt/doTotalMt/foRobMt/doRobMt
 * columns (removed in v3) so the crew never re-enters a number the ledger
 * already has. Pure function (no "server-only") so both server queries and
 * the client-side entry form/table can share it. */
export function foDoTotals(bunkers: { grade: BunkerGradeValue; consumed: number | null; rob: number | null }[]) {
  const sum = (grades: BunkerGradeValue[], field: "consumed" | "rob") =>
    bunkers.filter((b) => grades.includes(b.grade)).reduce((total, b) => total + (b[field] ?? 0), 0);
  return {
    foTotalMt: sum(FO_GRADES, "consumed"),
    doTotalMt: sum(DO_GRADES, "consumed"),
    foRobMt: sum(FO_GRADES, "rob"),
    doRobMt: sum(DO_GRADES, "rob"),
  };
}

/** Lube oil consumed per grade, kept separate (see LUBE_OIL_GRADES above)
 * rather than a single total. */
export function lubeOilTotals(bunkers: { grade: BunkerGradeValue; consumed: number | null }[]) {
  const sum = (grade: BunkerGradeValue) => bunkers.filter((b) => b.grade === grade).reduce((total, b) => total + (b.consumed ?? 0), 0);
  return {
    cylOilMt: sum("CYL_OIL"),
    meloMt: sum("MELO"),
    geloMt: sum("GELO"),
  };
}

/** Display label for a voyage leg — replaces the old standalone "Route /
 * Port Name" field (dropped in v3 as a duplicate of From/Next Port; a
 * single leg is already fully described by those two). */
export function routeLabel(fromPort: string | null, nextPort: string | null): string {
  if (fromPort && nextPort) return `${fromPort} - ${nextPort}`;
  return fromPort || nextPort || "—";
}

/** Report Time is free text like "0800H" or "1430" — pull out the first
 * HH:MM-ish run of digits; falls back to midnight if it doesn't parse
 * (e.g. blank, "N/A"). */
function parseReportTimeParts(input: string | null | undefined): { h: number; mi: number } {
  const m = input ? /(\d{1,2}):?(\d{2})/.exec(input) : null;
  if (!m) return { h: 0, mi: 0 };
  return { h: Math.min(23, Number(m[1])), mi: Math.min(59, Number(m[2])) };
}

/** A report's Date + Report Time as a single UTC instant, for elapsed-time
 * math (Total Time in Port = this entry's timestamp minus the last Arrival's
 * timestamp). Always built from UTC calendar-date components rather than
 * the environment's local timezone — the same as the naive-date convention
 * already used everywhere else this app treats `date` as "the calendar day",
 * so client and server compute the identical instant for the same input. */
export function reportDateTimeMs(date: Date | string, reportTimeLocal: string | null | undefined): number {
  const d = typeof date === "string" ? new Date(date) : date;
  const { h, mi } = parseReportTimeParts(reportTimeLocal);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h, mi);
}

// Blank text-input cells are common on partial-day legs (e.g. Steaming Time
// is blank on the first, short leg right after departure) — treat "" the
// same as not provided rather than a validation error.
const optionalNumber = () =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : v), z.coerce.number().optional());
const optionalInt = () =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : v), z.coerce.number().int().optional());

export const voyageLogFields = {
  date: z
    .string()
    .min(1, "Date is required")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  voyageNo: z.string().trim().max(50).optional().or(z.literal("")),
  reportType: z.enum(VOYAGE_REPORT_TYPES),
  vesselStatus: z.enum(VESSEL_TRACKER_STATUSES),
  ladenState: z.enum(LADEN_STATES),
  engineOrder: z.enum(ENGINE_ORDERS).optional().or(z.literal("")),
  // Manual entries — no separate From/To period range; `date` +
  // `reportTimeLocal` is this entry's one timestamp.
  steamingTimeHrs: optionalNumber(),
  obsSpeedKn: optionalNumber(),
  meSpeedKn: optionalNumber(),
  rpm: optionalNumber(),
  slipPct: optionalNumber(),
  beaufortScale: optionalInt(),
  portStayHrs: optionalNumber(),
  offHireHrs: optionalNumber(),

  fromPort: z.string().trim().max(200).optional().or(z.literal("")),
  nextPort: z.string().trim().max(200).optional().or(z.literal("")),
  course: z.string().trim().max(100).optional().or(z.literal("")),
  zoneDescription: z.string().trim().max(20).optional().or(z.literal("")),
  // Required — every "Total Time in Port" / "Steaming Time" elapsed-time
  // check anchors on this. A blank Report Time silently defaults to
  // midnight in that math, which produces a wrong-looking discrepancy
  // that's actually just a missing timestamp, not a real data error.
  reportTimeLocal: z.string().trim().min(1, "Report Time is required").max(20),
  position: z.string().trim().max(100).optional().or(z.literal("")),
  draftFwdM: optionalNumber(),
  draftAftM: optionalNumber(),
  draftMeanM: optionalNumber(),

  distanceRunNm: optionalNumber(),
  totalDistanceRunNm: optionalNumber(),
  dtgNextPortNm: optionalNumber(),
  totalSteamingTimeHrs: optionalNumber(),
  distanceLogNm: optionalNumber(),
  generalAvgSpeedKn: optionalNumber(),
  engineDistanceNm: optionalNumber(),
  totalEngineDistanceNm: optionalNumber(),
  generalAvgEngineSpeedKn: optionalNumber(),
  weatherCondition: z.string().trim().max(100).optional().or(z.literal("")),
  generalAvgSlipPct: optionalNumber(),
  barometer: optionalNumber(),
  exhaustTempUnit: z.string().trim().max(50).optional().or(z.literal("")),
  exhaustGasTemp: z.string().trim().max(200).optional().or(z.literal("")),

  etaNextPortDate: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Invalid date"),
  etaNextPortTime: z.string().trim().max(20).optional().or(z.literal("")),
  etaNextPortZd: z.string().trim().max(20).optional().or(z.literal("")),

  cargoOnboard: z.string().trim().max(200).optional().or(z.literal("")),
  cargoToDiscLoaded: z.string().trim().max(200).optional().or(z.literal("")),
  blQuantity: optionalNumber(),
  cargoTemp: z.string().trim().max(2000).optional().or(z.literal("")),
  agentName: z.string().trim().max(200).optional().or(z.literal("")),
  agentTel: z.string().trim().max(100).optional().or(z.literal("")),
  agentFax: z.string().trim().max(100).optional().or(z.literal("")),
  agentEmail: z.string().trim().max(200).optional().or(z.literal("")),
  agentAddress: z.string().trim().max(300).optional().or(z.literal("")),
  deckDeptReport: z.string().trim().max(4000).optional().or(z.literal("")),
  engineDeptReport: z.string().trim().max(4000).optional().or(z.literal("")),
  statementOfFacts: z.string().trim().max(8000).optional().or(z.literal("")),
  master: z.string().trim().max(200).optional().or(z.literal("")),
  chiefEngineer: z.string().trim().max(200).optional().or(z.literal("")),

  remarks: z.string().trim().max(2000).optional().or(z.literal("")),
};

// Fixed-row bunker table — one Previous/Received/Current-ROB group per
// grade, named `bunker_<GRADE>_<field>` on the form so it reads straight
// off FormData without a JSON blob (the grade list is fixed, unlike the
// variable-length row lists elsewhere in the app that do need JSON).
// "consumed" is NOT submitted — it's server-derived (previous + received -
// rob) in actions.ts, never trusted from the client.
export function bunkerFieldName(grade: BunkerGradeValue, field: "previous" | "received" | "rob"): string {
  return `bunker_${grade}_${field}`;
}

const bunkerFields = Object.fromEntries(
  BUNKER_GRADES.flatMap((grade) => [
    [bunkerFieldName(grade, "previous"), optionalNumber()],
    [bunkerFieldName(grade, "received"), optionalNumber()],
    [bunkerFieldName(grade, "rob"), optionalNumber()],
  ]),
);

export const addVoyageLogSchema = z.object({
  vesselId: z.string().uuid(),
  ...voyageLogFields,
  ...bunkerFields,
});

export const updateVoyageLogSchema = z.object({
  entryId: z.string().uuid(),
  ...voyageLogFields,
  ...bunkerFields,
});

export const deleteVoyageLogSchema = z.object({
  entryId: z.string().uuid(),
});

// Day-icon rendering (colored SVG badges, not emoji) lives in
// components/vessel-tracker/status-icons.tsx — emoji glyphs render tiny/
// faint and inconsistently across platforms, so this module only carries
// the semantic labels above.
