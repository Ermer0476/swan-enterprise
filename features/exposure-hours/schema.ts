import { z } from "zod";

// Reporting period buckets for the Exposure Summary dashboard's Period
// selector. Rolling 12 Months is the default — the maritime-industry
// convention for LTIF/TRCF (see the KPI dashboard) — but Monthly/Quarterly/
// YTD/Annual are offered for the more conventional calendar-anchored views
// office staff also expect.
export const SUMMARY_PERIODS = ["MONTHLY", "QUARTERLY", "YTD", "ROLLING_12", "ANNUAL"] as const;
export type SummaryPeriodKey = (typeof SUMMARY_PERIODS)[number];
export const SUMMARY_PERIOD_LABELS: Record<SummaryPeriodKey, string> = {
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  YTD: "YTD",
  ROLLING_12: "Rolling 12 Months",
  ANNUAL: "Annual",
};
export const DEFAULT_SUMMARY_PERIOD: SummaryPeriodKey = "ROLLING_12";

export const EXPOSURE_ENTERED_BY = ["VESSEL", "OFFICE"] as const;
export const EXPOSURE_ENTERED_BY_LABELS: Record<(typeof EXPOSURE_ENTERED_BY)[number], string> = {
  VESSEL: "Vessel",
  OFFICE: "Office",
};

// One recordable injury/case gets exactly ONE final classification — the
// most serious outcome it reached — never split across multiple categories
// as it evolves (e.g. medical treatment -> restricted duty -> lost time is
// still just one LWC, not MTC=1 + RWC=1 + LWC=1). Hierarchy, most to least
// severe: FAT > PTD > PPD > LWC > RWC > MTC > FAC (FAC isn't recordable —
// it doesn't count toward LTI or TRC).
export const INJURY_CLASSIFICATIONS = ["FAC", "MTC", "RWC", "LWC", "PPD", "PTD", "FAT"] as const;
export type InjuryClassificationValue = (typeof INJURY_CLASSIFICATIONS)[number];
export const INJURY_CLASSIFICATION_LABELS: Record<InjuryClassificationValue, string> = {
  FAC: "First Aid Case (FAC)",
  MTC: "Medical Treatment Case (MTC)",
  RWC: "Restricted Work Case (RWC)",
  LWC: "Lost Workday Case (LWC)",
  PPD: "Permanent Partial Disability (PPD)",
  PTD: "Permanent Total Disability (PTD)",
  FAT: "Fatality (FAT)",
};

// ─── Crew roster (drives total exposure hours) ─────────────────────────────
// Vessels don't submit a monthly period + crew count. They just log a crew
// count whenever it changes ("20 crew starting July 10"); total exposure
// hours for any date range is computed by integrating crew × 24h/day across
// this history — see computeHoursFromCrewEntries below.
export const addCrewEntrySchema = z.object({
  vesselId: z.string().uuid(),
  crew: z.coerce.number().int().min(0, "Crew count is required"),
  effectiveFrom: z
    .string()
    .min(1, "Effective date is required")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
});

export const updateCrewEntrySchema = addCrewEntrySchema
  .omit({ vesselId: true })
  .extend({ entryId: z.string().uuid() });

// ─── Injury cases ───────────────────────────────────────────────────────────
// Logged independently of the crew roster, each tagged with the date it
// happened — not tied to a monthly submission.
export const addInjuryCaseSchema = z.object({
  vesselId: z.string().uuid(),
  classification: z.enum(INJURY_CLASSIFICATIONS),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  occurredOn: z
    .string()
    .min(1, "Date is required")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
});

export const updateInjuryCaseSchema = addInjuryCaseSchema
  .omit({ vesselId: true })
  .extend({ caseId: z.string().uuid() });

// ─── Shared LTI/TRC formulas ────────────────────────────────────────────────
//  LTI = Lost Time Injury (FAT + PTD + PPD + LWC)
//  TRC = Total Recordable Case (LTI + RWC + MTC)
//  LTIF/TRCF = count × 1,000,000 / total exposure hours (per-million-hours rate)
export type ExposureCounts = {
  fat: number;
  ptd: number;
  ppd: number;
  lwc: number;
  rwc: number;
  mtc: number;
};

// Tally a set of single-classification cases into the FAT/PTD/PPD/LWC/RWC/MTC
// counts the KPI formulas need — the only place these numbers ever come
// from, so double-counting the same case in two buckets is structurally
// impossible (FAC cases fall out entirely — not recordable).
export function tallyClassifications(cases: { classification: string }[]): ExposureCounts {
  const totals: ExposureCounts = { fat: 0, ptd: 0, ppd: 0, lwc: 0, rwc: 0, mtc: 0 };
  for (const c of cases) {
    switch (c.classification as InjuryClassificationValue) {
      case "FAT": totals.fat++; break;
      case "PTD": totals.ptd++; break;
      case "PPD": totals.ppd++; break;
      case "LWC": totals.lwc++; break;
      case "RWC": totals.rwc++; break;
      case "MTC": totals.mtc++; break;
      case "FAC": break; // not recordable — doesn't feed LTI/TRC
    }
  }
  return totals;
}

export function computeLti(c: ExposureCounts): number {
  return c.fat + c.ptd + c.ppd + c.lwc;
}

export function computeTrc(c: ExposureCounts): number {
  return computeLti(c) + c.rwc + c.mtc;
}

export function computeFrequency(count: number, totalHours: number): number {
  return totalHours > 0 ? (count * 1_000_000) / totalHours : 0;
}

// Fleet KPI targets shown on the KPI dashboard's trend charts and gauges —
// per-company, editable at /settings/exposure-kpi (see Company.ltifTarget /
// trcfTarget). These are just the fallback if a Company row is somehow
// missing them.
export const DEFAULT_LTIF_TARGET = 1.0;
export const DEFAULT_TRCF_TARGET = 4.0;

export const updateKpiTargetsSchema = z.object({
  ltifTarget: z.coerce.number().positive("LTIF target must be greater than 0"),
  trcfTarget: z.coerce.number().positive("TRCF target must be greater than 0"),
});

// ─── Live total exposure hours from the crew roster ────────────────────────
export type CrewEntryInput = { crew: number; effectiveFrom: Date };

function utcDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

// Each crew entry's count applies from its effectiveFrom date until the next
// entry's effectiveFrom (or until rangeTo, for the latest one). Total hours
// for [rangeFrom, rangeTo] (inclusive of both ends) is the sum of
// crew × days-in-range × 24 across whichever entries overlap that window.
export function computeHoursFromCrewEntries(entries: CrewEntryInput[], rangeFrom: Date, rangeTo: Date): number {
  if (entries.length === 0) return 0;
  const dayMs = 24 * 60 * 60 * 1000;
  const rangeFromDay = utcDay(rangeFrom);
  const rangeToExclusive = utcDay(rangeTo) + dayMs;
  if (rangeToExclusive <= rangeFromDay) return 0;

  const sorted = [...entries].sort((a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime());

  let hours = 0;
  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    if (!entry) continue;
    const next = sorted[i + 1];
    const segStart = Math.max(utcDay(entry.effectiveFrom), rangeFromDay);
    const segEndExclusive = Math.min(next ? utcDay(next.effectiveFrom) : rangeToExclusive, rangeToExclusive);
    if (segEndExclusive <= segStart) continue;
    const days = Math.round((segEndExclusive - segStart) / dayMs);
    hours += entry.crew * days * 24;
  }
  return hours;
}
