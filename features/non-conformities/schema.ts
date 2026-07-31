import { z } from "zod";

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
// Lifecycle: OPEN → SUBMITTED_TO_OFFICE → CLOSED. Closing IS the
// verification act — only DPA / General Manager hold ncr:close.
export const NCR_STATUSES = ["OPEN", "SUBMITTED_TO_OFFICE", "CLOSED"] as const;

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
  // System suggests the next number (see suggestNextRefNo); user may edit it
  // before saving. Uniqueness is re-checked server-side in createNcrAction.
  refNo: z.string().trim().min(3, "NCR number is required").max(50),
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

export const capaNcrSchema = z.object({
  ncrId: z.string().uuid(),
  rootCause: z.string().trim().max(10000).optional().or(z.literal("")),
  correctiveAction: z.string().trim().max(10000).optional().or(z.literal("")),
  verification: z.string().trim().max(10000).optional().or(z.literal("")),
});
