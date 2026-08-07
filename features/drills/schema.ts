import { z } from "zod";

export const DRILL_STATUSES = ["OPEN", "CLOSED"] as const;

// Mirrors SMS form R-AS-021 "Report of Drill / Training onboard" (Appendix 6).
export const createDrillSchema = z.object({
  vesselId: z.string().uuid("Vessel is required"),
  scheduleItemId: z.string().uuid("Select which drill was conducted"),
  drillDate: z
    .string()
    .min(1, "Date is required")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  drillTime: z.string().trim().max(50).optional().or(z.literal("")),
  position: z.string().trim().max(200).optional().or(z.literal("")),
  participants: z.string().trim().max(2000).optional().or(z.literal("")),
  conductedBy: z.string().trim().max(200).optional().or(z.literal("")),
  details: z.string().trim().max(10000).optional().or(z.literal("")),
  deficiencies: z.string().trim().max(5000).optional().or(z.literal("")),
  correctiveAction: z.string().trim().max(5000).optional().or(z.literal("")),
  vesselRemarks: z.string().trim().max(2000).optional().or(z.literal("")),
});
