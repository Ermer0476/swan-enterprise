import { z } from "zod";

export const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
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
// Lifecycle: OPEN → IN_PROGRESS → VERIFIED → CLOSED
export const NCR_STATUSES = ["OPEN", "IN_PROGRESS", "VERIFIED", "CLOSED"] as const;

export const createNcrSchema = z.object({
  title: z.string().trim().min(3, "Title is required").max(200),
  vesselId: z.string().uuid().optional().or(z.literal("")),
  source: z.enum(NCR_SOURCES),
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
});

export const capaNcrSchema = z.object({
  ncrId: z.string().uuid(),
  rootCause: z.string().trim().max(10000).optional().or(z.literal("")),
  correctiveAction: z.string().trim().max(10000).optional().or(z.literal("")),
  verification: z.string().trim().max(10000).optional().or(z.literal("")),
});
