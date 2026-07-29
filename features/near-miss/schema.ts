import { z } from "zod";
import {
  ROOT_CAUSE_CATEGORIES,
  HUMAN_FACTORS,
  MAX_CONTRIBUTING_FACTORS,
} from "@/lib/root-cause";

export const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const NM_STATUSES = ["REPORTED", "UNDER_REVIEW", "CLOSED"] as const;

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
    humanFactorPrimary: z.enum(HUMAN_FACTORS).optional(),
    humanFactorContributing: z
      .array(z.enum(HUMAN_FACTORS))
      .max(MAX_CONTRIBUTING_FACTORS, "Choose at most two contributing factors"),

    // Corrective action plan — captured in the same report too (paired by
    // index, like the SOF rows on Incidents). Blank rows (no action text)
    // are dropped, not validated.
    caAction: z.array(z.string()).default([]),
    caResponsible: z.array(z.string()).default([]),
    caTargetDate: z.array(z.string()).default([]),
  })
  .superRefine((v, ctx) => {
    if (v.rootCauseCategory === "HUMAN_FACTORS" && !v.humanFactorPrimary) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select the primary human factor",
        path: ["humanFactorPrimary"],
      });
    }
  });

export const officeReviewSchema = z.object({
  nearMissId: z.string().uuid(),
  companyComments: z.string().trim().max(10000).optional().or(z.literal("")),
  // Entered manually by the reviewer — never auto-filled.
  reviewedAt: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Invalid date"),
});

export type CapaPlanRow = { action: string; responsible: string; targetDate: string };

/** Zips caAction/caResponsible/caTargetDate (paired by index); drops rows with no action text. */
export function buildCapaRows(
  caAction: string[],
  caResponsible: string[],
  caTargetDate: string[],
): CapaPlanRow[] {
  const rows: CapaPlanRow[] = [];
  for (let i = 0; i < caAction.length; i++) {
    const action = (caAction[i] ?? "").trim();
    if (!action) continue;
    rows.push({
      action,
      responsible: (caResponsible[i] ?? "").trim(),
      targetDate: (caTargetDate[i] ?? "").trim(),
    });
  }
  return rows;
}
