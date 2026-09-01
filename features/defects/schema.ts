import { z } from "zod";

export const DEFECT_SEVERITIES = ["MINOR", "MAJOR", "CRITICAL"] as const;
export const DEFECT_STATUSES = ["OPEN", "MONITORING", "RECTIFIED", "DEFERRED"] as const;

export const createDefectSchema = z.object({
  vesselId: z.string().uuid("Vessel is required"),
  equipment: z.string().trim().min(2, "Equipment / system is required").max(200),
  description: z.string().trim().min(5, "Describe the defect").max(5000),
  severity: z.enum(DEFECT_SEVERITIES),
  dateRaised: z
    .string()
    .min(1, "Date is required")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  targetRectificationDate: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Invalid date"),
  raisedBy: z.string().trim().max(200).optional().or(z.literal("")),
});

export const updateDefectSchema = z.object({
  defectId: z.string().uuid(),
  status: z.enum(DEFECT_STATUSES),
  actionTaken: z.string().trim().max(5000).optional().or(z.literal("")),
  targetRectificationDate: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Invalid date"),
  // Manually entered by whoever closes the defect — the actual date the
  // work was done, not necessarily today (the day it's being logged).
  rectifiedAt: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Invalid date"),
});

// Ship- and office-side remarks — each saved to its OWN column so the two
// (and the structured status/action) never overwrite each other.
export const defectRemarksSchema = z.object({
  defectId: z.string().uuid(),
  kind: z.enum(["vessel", "office"]),
  value: z.string().trim().max(5000).optional().or(z.literal("")),
});
