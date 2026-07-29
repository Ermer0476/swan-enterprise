import { z } from "zod";

export const INSPECTION_STATUSES = ["OPEN", "IN_PROGRESS", "CLOSED"] as const;
export const FINDING_STATUSES = ["OPEN", "CLOSED"] as const;
// SIRE 2.0 observation categories.
export const SIRE_CATEGORIES = [
  "Hardware",
  "Process",
  "Human",
  "Photograph",
] as const;

export const createSireSchema = z.object({
  vesselId: z.string().uuid().optional().or(z.literal("")),
  inspectingCompany: z
    .string()
    .trim()
    .min(2, "Inspecting company is required")
    .max(200),
  inspectorName: z.string().trim().max(200).optional().or(z.literal("")),
  port: z.string().trim().max(200).optional().or(z.literal("")),
  inspectionDate: z
    .string()
    .min(1, "Date is required")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  sireVersion: z.string().trim().max(20).optional().or(z.literal("")),
  summary: z.string().trim().max(10000).optional().or(z.literal("")),
});

export const addObservationSchema = z.object({
  inspectionId: z.string().uuid(),
  viqRef: z.string().trim().max(40).optional().or(z.literal("")),
  category: z.string().trim().max(40).optional().or(z.literal("")),
  observation: z.string().trim().min(3, "Observation is required").max(10000),
});

export const updateObservationSchema = z.object({
  observationId: z.string().uuid(),
  response: z.string().trim().max(10000).optional().or(z.literal("")),
  status: z.enum(FINDING_STATUSES),
});
