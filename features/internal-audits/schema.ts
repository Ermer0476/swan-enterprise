import { z } from "zod";

export const INSPECTION_STATUSES = ["OPEN", "IN_PROGRESS", "CLOSED"] as const;
export const FINDING_CATEGORIES = ["MAJOR_NC", "MINOR_NC", "OBSERVATION"] as const;
export const FINDING_STATUSES = ["OPEN", "CLOSED"] as const;

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

export const updateFindingSchema = z.object({
  findingId: z.string().uuid(),
  correctiveAction: z.string().trim().max(10000).optional().or(z.literal("")),
  status: z.enum(FINDING_STATUSES),
});
