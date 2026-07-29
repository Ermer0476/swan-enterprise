import { z } from "zod";

export const INSPECTION_STATUSES = ["OPEN", "IN_PROGRESS", "CLOSED"] as const;
export const FINDING_STATUSES = ["OPEN", "CLOSED"] as const;
export const CDI_SCHEMES = ["CDI-M", "CDI-T", "CDI-SQAS"] as const;

export const createCdiSchema = z.object({
  vesselId: z.string().uuid().optional().or(z.literal("")),
  inspectorName: z.string().trim().max(200).optional().or(z.literal("")),
  scheme: z.string().trim().max(20).optional().or(z.literal("")),
  port: z.string().trim().max(200).optional().or(z.literal("")),
  inspectionDate: z
    .string()
    .min(1, "Date is required")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  summary: z.string().trim().max(10000).optional().or(z.literal("")),
});

export const addObservationSchema = z.object({
  inspectionId: z.string().uuid(),
  questionRef: z.string().trim().max(40).optional().or(z.literal("")),
  observation: z.string().trim().min(3, "Observation is required").max(10000),
});

export const updateObservationSchema = z.object({
  observationId: z.string().uuid(),
  response: z.string().trim().max(10000).optional().or(z.literal("")),
  status: z.enum(FINDING_STATUSES),
});
