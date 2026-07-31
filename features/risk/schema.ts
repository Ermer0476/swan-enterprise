import { z } from "zod";

export const RISK_RATINGS = ["LOW", "MEDIUM", "HIGH"] as const;
export const RISK_STATUSES = ["ACTIVE", "SUPERSEDED", "CLOSED"] as const;

/** Simple likelihood × severity matrix — a reasonable working default, not a
 * substitute for a full company risk-matrix policy. */
export function computeRiskLevel(
  likelihood: (typeof RISK_RATINGS)[number],
  severity: (typeof RISK_RATINGS)[number],
): (typeof RISK_RATINGS)[number] {
  const idx = { LOW: 0, MEDIUM: 1, HIGH: 2 } as const;
  const sum = idx[likelihood] + idx[severity];
  if (sum <= 1) return "LOW";
  if (sum <= 3) return "MEDIUM";
  return "HIGH";
}

export const createRiskAssessmentSchema = z.object({
  activity: z.string().trim().min(3, "Activity / task is required").max(200),
  vesselId: z.string().uuid().optional().or(z.literal("")),
  hazards: z.string().trim().min(3, "Describe the hazards identified").max(5000),
  existingControls: z.string().trim().max(5000).optional().or(z.literal("")),
  likelihood: z.enum(RISK_RATINGS),
  severity: z.enum(RISK_RATINGS),
  additionalControls: z.string().trim().max(5000).optional().or(z.literal("")),
  assessedBy: z.string().trim().max(200).optional().or(z.literal("")),
  assessmentDate: z
    .string()
    .min(1, "Date is required")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  reviewDate: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Invalid date"),
});
