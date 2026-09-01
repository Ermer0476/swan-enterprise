import { z } from "zod";
import {
  ROOT_CAUSE_CATEGORIES,
  ROOT_CAUSE_SUBCATEGORIES,
  type RootCauseCategoryValue,
} from "@/lib/root-cause";

export const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

// Shipboard NCR creation is restricted to senior officers (Master / Chief
// Officer / Chief Engineer) — not every crew member holding ncr:create.
// Office-side creation has no extra rank gate; ncr:create there is only
// granted to manager-tier roles already (QHSE Manager, Marine Superintendent).
export const NCR_SHIP_CREATOR_RANKS = ["Master", "C/Off", "C/Engr"] as const;
export const NCR_SOURCES = [
  "INTERNAL_AUDIT",
  "EXTERNAL_AUDIT",
  "PSC",
  "SIRE",
  "CDI",
  "VETTING",
  "FLAG_STATE",
  "OTHER",
] as const;
// Lifecycle: DRAFT → SUBMITTED_TO_OFFICE → VERIFIED → CLOSED. Raising a
// finding (whether directly or by reporting a Draft) goes straight to
// SUBMITTED_TO_OFFICE — there's no separate "Open, not yet submitted" step,
// since the vessel and office already share the same live record the moment
// it's raised. SUBMITTED_TO_OFFICE → VERIFIED goes through verifyNcrAction;
// VERIFIED → CLOSED goes through closeNcrAction — each needs its own
// dedicated data (see the guards in actions.ts). The Prisma enum still has an
// unused OPEN value for old records' history; nothing writes it anymore.
export const NCR_STATUSES = ["DRAFT", "SUBMITTED_TO_OFFICE", "VERIFIED", "CLOSED"] as const;

// R-AS-001's "Verification of Corrective Action" either/or choice.
export const NCR_VERIFICATION_OUTCOMES = ["COMPLETED", "FOLLOWUP_REQUIRED"] as const;
export const NCR_VERIFICATION_OUTCOME_LABELS: Record<(typeof NCR_VERIFICATION_OUTCOMES)[number], string> = {
  COMPLETED: "Completed per SMS",
  FOLLOWUP_REQUIRED: "Follow-up is required as per SMS",
};

// Person In Charge — a single owner, but flexible: a named title (shipboard)
// or a whole department (common for office-raised NCRs).
export const PERSON_IN_CHARGE_OPTIONS = [
  "Master",
  "Chief Engineer",
  "Marine Department",
  "Technical Department",
  "Purchasing Department",
] as const;

export const createNcrSchema = z.object({
  // refNo is NOT taken from the client — letting it be typed/edited was
  // producing duplicates and out-of-sequence numbers. createNcrAction always
  // assigns the next number itself, taken from the last NCR on record.
  title: z.string().trim().min(3, "Title is required").max(200),
  vesselId: z.string().uuid().optional().or(z.literal("")),
  departmentName: z.string().trim().max(200).optional().or(z.literal("")),
  source: z.enum(NCR_SOURCES),
  // Soft link to the specific finding/deficiency this NCR was raised from —
  // set only when auto-opened from PSC/Internal/External Audit "Add
  // Deficiency" (one finding = one NCR). Blank for manually-raised NCRs.
  sourceEntityId: z.string().trim().max(100).optional().or(z.literal("")),
  requirement: z
    .string()
    .trim()
    .min(2, "State the clause/requirement breached")
    .max(500),
  severity: z.enum(SEVERITIES),
  raisedAt: z
    .string()
    .min(1, "Date is required")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  targetDate: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Invalid date"),
  description: z.string().trim().min(10, "Describe the non-conformity").max(10000),
  personInCharge: z.enum(PERSON_IN_CHARGE_OPTIONS),
  reporterName: z.string().trim().max(200).optional().or(z.literal("")),
});

// Root cause classification — same shared taxonomy Incident/Near Miss use
// (lib/root-cause.ts). Corrective actions themselves are recorded in the
// shared CapaAction tracker (entityType "NonConformity"), not here.
export const rootCauseSchema = z
  .object({
    ncrId: z.string().uuid(),
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

// R-AS-001 section 6 — DPA / Safety Mgt. Committee verification of the
// corrective action, gating SUBMITTED_TO_OFFICE → VERIFIED.
export const verifyNcrSchema = z
  .object({
    ncrId: z.string().uuid(),
    verificationOutcome: z.enum(NCR_VERIFICATION_OUTCOMES),
    verificationFollowUpNature: z.string().trim().max(2000).optional().or(z.literal("")),
    assistanceRequired: z.boolean(),
    assistanceNature: z.string().trim().max(2000).optional().or(z.literal("")),
  })
  .superRefine((v, ctx) => {
    if (v.verificationOutcome === "FOLLOWUP_REQUIRED" && !v.verificationFollowUpNature) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Describe the nature of the required follow-up",
        path: ["verificationFollowUpNature"],
      });
    }
    if (v.assistanceRequired && !v.assistanceNature) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Describe the nature of the required assistance",
        path: ["assistanceNature"],
      });
    }
  });

// R-AS-001 section 7 — Close Out, gating VERIFIED → CLOSED.
export const closeNcrSchema = z
  .object({
    ncrId: z.string().uuid(),
    closeOutFollowUpRequired: z.boolean(),
    closeOutFollowUpNature: z.string().trim().max(2000).optional().or(z.literal("")),
    // Manually entered, not auto-stamped to today — the office may be
    // recording a close-out that actually happened on an earlier date.
    closedOutDate: z
      .string()
      .min(1, "Enter the closed out date")
      .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  })
  .superRefine((v, ctx) => {
    if (v.closeOutFollowUpRequired && !v.closeOutFollowUpNature) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Describe the nature of the required follow-up",
        path: ["closeOutFollowUpNature"],
      });
    }
  });
