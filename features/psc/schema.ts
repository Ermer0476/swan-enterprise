import { z } from "zod";
import { ROOT_CAUSE_CATEGORIES } from "@/lib/root-cause";

export const INSPECTION_STATUSES = ["OPEN", "IN_PROGRESS", "CLOSED"] as const;

// PSC KPI dashboard period selector — Rolling 12 Months default, matching
// the same maritime-standard convention used on Exposure Hours' KPI page.
export const PSC_KPI_PERIODS = ["ROLLING_12", "YTD", "YEARLY"] as const;
export type PscKpiPeriodKey = (typeof PSC_KPI_PERIODS)[number];
export const PSC_KPI_PERIOD_LABELS: Record<PscKpiPeriodKey, string> = {
  ROLLING_12: "Rolling 12 Months",
  YTD: "YTD",
  YEARLY: "Yearly",
};
export const DEFAULT_PSC_KPI_PERIOD: PscKpiPeriodKey = "ROLLING_12";

export const MOU_REGIONS = [
  "Tokyo MOU",
  "Paris MOU",
  "USCG",
  "Indian Ocean MOU",
  "Mediterranean MOU",
  "Caribbean MOU",
  "Viña del Mar",
  "Black Sea MOU",
  "Riyadh MOU",
  "Abuja MOU",
  "Other",
] as const;

export const createPscSchema = z.object({
  vesselId: z.string().uuid().optional().or(z.literal("")),
  authority: z.string().trim().min(2, "Authority is required").max(200),
  mouRegion: z.string().trim().max(80).optional().or(z.literal("")),
  port: z.string().trim().max(200).optional().or(z.literal("")),
  inspectionDate: z
    .string()
    .min(1, "Date is required")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  detained: z.union([z.literal("on"), z.literal("")]).optional(),
  summary: z.string().trim().max(10000).optional().or(z.literal("")),
});

export const addDeficiencySchema = z.object({
  inspectionId: z.string().uuid(),
  natureCode: z.string().trim().max(40).optional().or(z.literal("")),
  reference: z.string().trim().max(120).optional().or(z.literal("")),
  actionCode: z.string().trim().max(40).optional().or(z.literal("")),
  description: z.string().trim().min(3, "Description is required").max(10000),
});

// Root cause classification — same shared taxonomy Incident/Near Miss/NCR
// use (lib/root-cause.ts). Corrective actions themselves are recorded in the
// shared CapaAction tracker (entityType "PscDeficiency"), not here.
// The sub-category membership check is NOT a superRefine here: the allowed set
// is the office-editable reference list (root-cause-subcategory:<CATEGORY>), which
// needs the company id and a DB read, so it lives in the save action (∪ the
// value already persisted on the row being edited).
export const deficiencyRootCauseSchema = z
  .object({
    deficiencyId: z.string().uuid(),
    rootCauseCategory: z.enum(ROOT_CAUSE_CATEGORIES),
    rootCauseSubCategory: z.string().trim().min(1, "Select the root cause sub-category"),
    rootCause: z.string().trim().max(10000).optional().or(z.literal("")),
  });
