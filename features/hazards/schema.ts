import { z } from "zod";

export const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const HAZARD_TYPES = ["UNSAFE_ACT", "UNSAFE_CONDITION"] as const;
export const HAZARD_STATUSES = ["OPEN", "IN_PROGRESS", "CLOSED"] as const;

// Common hazard categories — free text is also allowed via the "Other" path,
// but a curated list keeps reporting consistent for analytics.
export const HAZARD_CATEGORIES = [
  "PPE",
  "Housekeeping",
  "Machinery / Equipment",
  "Working at Height",
  "Enclosed Space",
  "Electrical",
  "Fire",
  "Slips / Trips / Falls",
  "Manual Handling",
  "Environmental",
  "Other",
] as const;

export const createHazardSchema = z.object({
  title: z.string().trim().min(3, "Title is required").max(200),
  vesselId: z.string().uuid().optional().or(z.literal("")),
  observedAt: z
    .string()
    .min(1, "Date is required")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  location: z.string().trim().max(200).optional().or(z.literal("")),
  category: z.string().trim().min(2, "Category is required").max(80),
  hazardType: z.enum(HAZARD_TYPES),
  riskLevel: z.enum(SEVERITIES),
  observation: z.string().trim().min(10, "Describe what you observed").max(10000),
  immediateAction: z.string().trim().max(10000).optional().or(z.literal("")),
});

export const actionHazardSchema = z.object({
  hazardId: z.string().uuid(),
  correctiveAction: z.string().trim().max(10000).optional().or(z.literal("")),
});
