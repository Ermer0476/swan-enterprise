import { z } from "zod";

export const createFamiliarizationSchema = z.object({
  vesselId: z.string().uuid("Vessel is required"),
  scheduleItemId: z.string().uuid("Select which topic was covered"),
  completedDate: z
    .string()
    .min(1, "Date is required")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  notedBy: z.string().trim().max(200).optional().or(z.literal("")),
  remarks: z.string().trim().max(2000).optional().or(z.literal("")),
});
