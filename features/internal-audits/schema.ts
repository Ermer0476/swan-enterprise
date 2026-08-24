import { z } from "zod";
import {
  ROOT_CAUSE_CATEGORIES,
  ROOT_CAUSE_SUBCATEGORIES,
  type RootCauseCategoryValue,
} from "@/lib/root-cause";

// DRAFT → OPEN always goes through reportDraftInternalAuditAction (assigns
// refNo), never a generic advance path — findings can't be added to a draft
// (see the DRAFT guard in addFindingAction).
export const INSPECTION_STATUSES = ["DRAFT", "OPEN", "IN_PROGRESS", "CLOSED"] as const;
export const FINDING_CATEGORIES = ["MAJOR_NC", "MINOR_NC", "OBSERVATION"] as const;

// ISM requires an internal audit of every vessel at least once every 12
// months — unlike SIRE (which schedules a buffer month ahead of a hard
// validity expiry), an internal audit doesn't "expire," so there's no
// separate validity window here, just the recurrence interval itself.
export const INTERNAL_AUDIT_SCHEDULE_MONTHS = 12;

export const INTERNAL_AUDIT_SCHEDULE_URGENCIES = ["NOT_YET_AUDITED", "OVERDUE", "DUE_SOON", "ON_TRACK"] as const;
export type InternalAuditScheduleUrgency = (typeof INTERNAL_AUDIT_SCHEDULE_URGENCIES)[number];
export const INTERNAL_AUDIT_SCHEDULE_URGENCY_LABELS: Record<InternalAuditScheduleUrgency, string> = {
  NOT_YET_AUDITED: "Not Yet Audited",
  OVERDUE: "Overdue",
  DUE_SOON: "Due Soon",
  ON_TRACK: "On Track",
};

export const createInternalAuditSchema = z.object({
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
// shared CapaAction tracker (entityType "InternalAuditFinding"), not here.
export const findingRootCauseSchema = z
  .object({
    findingId: z.string().uuid(),
    rootCauseCategory: z.enum(ROOT_CAUSE_CATEGORIES),
    rootCauseSubCategory: z.string().trim().min(1, "Select the root cause sub-category"),
    rootCause: z.string().trim().max(10000).optional().or(z.literal("")),
  })
  .superRefine((v, ctx) => {
    const allowed = ROOT_CAUSE_SUBCATEGORIES[v.rootCauseCategory as RootCauseCategoryValue];
    if (!allowed.includes(v.rootCauseSubCategory)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a valid sub-category for the chosen category",
        path: ["rootCauseSubCategory"],
      });
    }
  });
