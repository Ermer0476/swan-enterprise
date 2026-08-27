import { z } from "zod";
import { ROOT_CAUSE_CATEGORIES } from "@/lib/root-cause";

export const INSPECTION_STATUSES = ["OPEN", "IN_PROGRESS", "CLOSED"] as const;
export const FINDING_CATEGORIES = ["MAJOR_NC", "MINOR_NC", "OBSERVATION"] as const;

// External Audits KPI dashboard period selector — same 3-option convention
// as PSC's KPI page, Rolling 12 Months default.
export const EAUDIT_KPI_PERIODS = ["ROLLING_12", "YTD", "YEARLY"] as const;
export type EauditKpiPeriodKey = (typeof EAUDIT_KPI_PERIODS)[number];
export const EAUDIT_KPI_PERIOD_LABELS: Record<EauditKpiPeriodKey, string> = {
  ROLLING_12: "Rolling 12 Months",
  YTD: "YTD",
  YEARLY: "Yearly",
};
export const DEFAULT_EAUDIT_KPI_PERIOD: EauditKpiPeriodKey = "ROLLING_12";

export const createExternalAuditSchema = z.object({
  vesselId: z.string().uuid().optional().or(z.literal("")),
  scope: z.string().trim().min(2, "Scope is required").max(200),
  standard: z.string().trim().min(2, "Standard is required").max(80),
  auditorName: z.string().trim().max(200).optional().or(z.literal("")),
  auditBody: z.string().trim().max(200).optional().or(z.literal("")),
  auditDate: z
    .string()
    .min(1, "Date is required")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  summary: z.string().trim().max(10000).optional().or(z.literal("")),
});

export const addFindingSchema = z.object({
  auditId: z.string().uuid(),
  category: z.enum(FINDING_CATEGORIES),
  reference: z.string().trim().max(120).optional().or(z.literal("")),
  description: z.string().trim().min(3, "Description is required").max(10000),
});

// Root cause classification — same shared taxonomy Incident/Near Miss/NCR/PSC
// use (lib/root-cause.ts). Corrective actions themselves are recorded in the
// shared CapaAction tracker (entityType "ExternalAuditFinding"), not here.
// The sub-category membership check is NOT a superRefine here: the allowed set
// is the office-editable reference list (root-cause-subcategory:<CATEGORY>), which
// needs the company id and a DB read, so it lives in the save action (∪ the
// value already persisted on the row being edited).
export const findingRootCauseSchema = z
  .object({
    findingId: z.string().uuid(),
    rootCauseCategory: z.enum(ROOT_CAUSE_CATEGORIES),
    rootCauseSubCategory: z.string().trim().min(1, "Select the root cause sub-category"),
    rootCause: z.string().trim().max(10000).optional().or(z.literal("")),
  });
