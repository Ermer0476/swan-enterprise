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
// Lifecycle: DRAFT → OPEN → SUBMITTED_TO_OFFICE → CLOSED. Closing IS the
// verification act — only DPA / General Manager hold ncr:close. DRAFT →
// OPEN always goes through reportDraftNcrAction (assigns refNo), never the
// generic advanceNcrAction — see the DRAFT guard there.
export const NCR_STATUSES = ["DRAFT", "OPEN", "SUBMITTED_TO_OFFICE", "CLOSED"] as const;

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
});

// Office's written reply on this NCR — same app-wide "shore feedback on a
// vessel/office-raised report" field as Near Miss / Committee Meetings (see
// COMMENTS_STANDARDIZATION_REPORT.md). NCR has no ship/office permission
// split elsewhere in this module, so this is gated by ncr:update like
// everything else here, not a separate office-only permission.
export const shoreRemarksSchema = z.object({
  ncrId: z.string().uuid(),
  shoreRemarks: z.string().trim().max(10000).optional().or(z.literal("")),
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
