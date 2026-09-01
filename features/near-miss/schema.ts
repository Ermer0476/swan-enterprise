import { z } from "zod";
import {
  ROOT_CAUSE_CATEGORIES,
  ROOT_CAUSE_SUBCATEGORIES,
  type RootCauseCategoryValue,
} from "@/lib/root-cause";
import { REPORTER_POSITIONS, SHIP_POSITIONS, OFFICE_POSITIONS, positionsFor } from "@/lib/crew-ranks";
import { humanize } from "@/lib/utils";
import { LIFECYCLE_TONE } from "@/lib/status";

export { REPORTER_POSITIONS, SHIP_POSITIONS, OFFICE_POSITIONS, positionsFor };

export const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
// DRAFT is the vessel's own work-in-progress, invisible to the office (see
// queries.ts) until "Report Near Miss" moves it to REPORTED.
export const NM_STATUSES = ["DRAFT", "REPORTED", "UNDER_REVIEW", "CLOSED"] as const;

/**
 * Office-facing status label. The vessel's own "Reported"/"Under Review"
 * distinction is an internal office-review detail — from the office side,
 * anything not yet Closed just reads "For Review". Shipboard viewers keep
 * seeing the underlying status as-is. (DRAFT never reaches an office viewer
 * at all — filtered out at the query layer — but falls through to humanize
 * here defensively.)
 */
export function nearMissStatusLabel(status: string, department: string): string {
  if (department === "SHIPBOARD" || status === "CLOSED" || status === "DRAFT") return humanize(status);
  return "For Review";
}

/**
 * Badge tone — app-wide OPEN/UNDER_REVIEW/CLOSED color standard. DRAFT (still
 * being actively edited by the vessel) is the OPEN case; REPORTED and
 * UNDER_REVIEW both mean "out of the vessel's hands, awaiting the other
 * side," so both are UNDER_REVIEW regardless of which department is looking
 * — only the *label* (`nearMissStatusLabel`) varies by department, not the
 * color, so the same underlying status always reads as the same color.
 */
export function nearMissStatusTone(status: string): "success" | "warning" | "danger" {
  if (status === "CLOSED") return LIFECYCLE_TONE.CLOSED;
  if (status === "DRAFT") return LIFECYCLE_TONE.OPEN;
  return LIFECYCLE_TONE.UNDER_REVIEW; // REPORTED or UNDER_REVIEW
}

// Near Miss vs Hazard Observation (HOR) — one merged report/module.
export const NEARMISS_KINDS = ["NEAR_MISS", "HOR"] as const;
export const NEARMISS_KIND_LABELS: Record<(typeof NEARMISS_KINDS)[number], string> = {
  NEAR_MISS: "Near Miss",
  HOR: "Hazard Observation (HOR)",
};

// HOR-only classification — which type of incident could have happened.
export const HOR_CATEGORIES = ["UNSAFE_ACT", "UNSAFE_CONDITION"] as const;
export const HOR_CATEGORY_LABELS: Record<(typeof HOR_CATEGORIES)[number], string> = {
  UNSAFE_ACT: "Unsafe Act",
  UNSAFE_CONDITION: "Unsafe Condition",
};

export const NEARMISS_LOCATIONS = [
  "Bridge",
  "Deck",
  "Engine room",
  "Poop Deck",
  "Forecastle deck",
  "Cargo area",
  "Inside accommodation",
] as const;

export const NEARMISS_CONSEQUENCE_TYPES = [
  "INJURY_ILL_HEALTH",
  "ENVIRONMENTAL_DAMAGE",
  "PROPERTY_DAMAGE",
  "FIRE_EXPLOSION",
  "LOSS_OF_CONTAINMENT",
  "NAVIGATION_MARINE_INCIDENT",
  "SECURITY",
  "REGULATORY",
] as const;
export const NEARMISS_CONSEQUENCE_LABELS: Record<(typeof NEARMISS_CONSEQUENCE_TYPES)[number], string> = {
  INJURY_ILL_HEALTH: "Injury / Ill Health",
  ENVIRONMENTAL_DAMAGE: "Environmental Damage",
  PROPERTY_DAMAGE: "Property Damage",
  FIRE_EXPLOSION: "Fire / Explosion",
  LOSS_OF_CONTAINMENT: "Loss of Containment",
  NAVIGATION_MARINE_INCIDENT: "Navigation / Marine Incident",
  SECURITY: "Security",
  REGULATORY: "Regulatory",
};

export const createNearMissSchema = z
  .object({
    title: z.string().trim().min(3, "Title is required").max(200),
    reporterName: z.string().trim().min(2, "Enter the reporter's name").max(120),
    reporterPosition: z.enum(REPORTER_POSITIONS),
    kind: z.enum(NEARMISS_KINDS),
    horCategory: z.enum(HOR_CATEGORIES).optional(),
    stopAuthorityExercised: z.boolean(),
    vesselId: z.string().uuid().optional().or(z.literal("")),
    occurredAt: z
      .string()
      .min(1, "Date is required")
      .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
    location: z.enum(NEARMISS_LOCATIONS).optional().or(z.literal("")),
    description: z.string().trim().min(10, "Describe what happened").max(10000),
    potentialConsequence: z.enum(NEARMISS_CONSEQUENCE_TYPES),
    potentialSeverity: z.enum(SEVERITIES),
    immediateAction: z.string().trim().max(10000).optional().or(z.literal("")),

    // Root cause — captured in the same report (no separate investigation
    // phase for Near Miss).
    rootCauseCategory: z.enum(ROOT_CAUSE_CATEGORIES),
    rootCauseSubCategory: z.string().trim().min(1, "Select the root cause sub-category"),

    // Corrective action plan — captured in the same report too (paired by
    // index, like the SOF rows on Incidents). Blank rows (no action text)
    // are dropped, not validated.
    caAction: z.array(z.string()).default([]),
    caResponsible: z.array(z.string()).default([]),
    caTargetDate: z.array(z.string()).default([]),
    // Only ever honored server-side when the reporter is SHIPBOARD — lets the
    // vessel mark a corrective action already resolved at the time of filing,
    // instead of always starting every row as OPEN.
    caStatus: z.array(z.string()).default([]),
    caClosedDate: z.array(z.string()).default([]),
  })
  .superRefine((v, ctx) => {
    const allowed = ROOT_CAUSE_SUBCATEGORIES[v.rootCauseCategory as RootCauseCategoryValue];
    if (!allowed.includes(v.rootCauseSubCategory)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a valid sub-category for the chosen root cause",
        path: ["rootCauseSubCategory"],
      });
    }
    if (v.kind === "HOR" && !v.horCategory) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select the HOR category (Unsafe Act / Unsafe Condition)",
        path: ["horCategory"],
      });
    }
  });

export const officeReviewSchema = z.object({
  nearMissId: z.string().uuid(),
  shoreRemarks: z.string().trim().max(10000).optional().or(z.literal("")),
  // Entered manually by the reviewer — never auto-filled.
  reviewedAt: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Invalid date"),
});

export type CapaPlanRow = {
  action: string;
  responsible: string;
  targetDate: string;
  status: string;
  closedDate: string;
};

/** Zips the caAction/caResponsible/caTargetDate/caStatus/caClosedDate arrays (paired by index); drops rows with no action text. */
export function buildCapaRows(
  caAction: string[],
  caResponsible: string[],
  caTargetDate: string[],
  caStatus: string[] = [],
  caClosedDate: string[] = [],
): CapaPlanRow[] {
  const rows: CapaPlanRow[] = [];
  for (let i = 0; i < caAction.length; i++) {
    const action = (caAction[i] ?? "").trim();
    if (!action) continue;
    rows.push({
      action,
      responsible: (caResponsible[i] ?? "").trim(),
      targetDate: (caTargetDate[i] ?? "").trim(),
      status: (caStatus[i] ?? "").trim(),
      closedDate: (caClosedDate[i] ?? "").trim(),
    });
  }
  return rows;
}
