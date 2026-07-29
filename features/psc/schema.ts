import { z } from "zod";

export const INSPECTION_STATUSES = ["OPEN", "IN_PROGRESS", "CLOSED"] as const;
export const FINDING_STATUSES = ["OPEN", "CLOSED"] as const;
export const MOU_REGIONS = [
  "Tokyo MOU",
  "Paris MOU",
  "USCG",
  "Indian Ocean MOU",
  "Mediterranean MOU",
  "Caribbean MOU",
  "Viña del Mar",
  "Black Sea MOU",
  "Riyadh MOU",
  "Abuja MOU",
  "Other",
] as const;

export const createPscSchema = z.object({
  vesselId: z.string().uuid().optional().or(z.literal("")),
  authority: z.string().trim().min(2, "Authority is required").max(200),
  mouRegion: z.string().trim().max(80).optional().or(z.literal("")),
  port: z.string().trim().max(200).optional().or(z.literal("")),
  inspectionDate: z
    .string()
    .min(1, "Date is required")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  detained: z.union([z.literal("on"), z.literal("")]).optional(),
  summary: z.string().trim().max(10000).optional().or(z.literal("")),
});

export const addDeficiencySchema = z.object({
  inspectionId: z.string().uuid(),
  natureCode: z.string().trim().max(40).optional().or(z.literal("")),
  reference: z.string().trim().max(120).optional().or(z.literal("")),
  actionCode: z.string().trim().max(40).optional().or(z.literal("")),
  description: z.string().trim().min(3, "Description is required").max(10000),
});

export const updateDeficiencySchema = z.object({
  deficiencyId: z.string().uuid(),
  rectification: z.string().trim().max(10000).optional().or(z.literal("")),
  status: z.enum(FINDING_STATUSES),
});
