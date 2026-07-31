import { z } from "zod";

export const DRILL_TYPES = [
  "FIRE",
  "ABANDON_SHIP",
  "MAN_OVERBOARD",
  "ENCLOSED_SPACE",
  "OIL_SPILL",
  "SECURITY",
  "STEERING_FAILURE",
  "DAMAGE_CONTROL",
  "OTHER",
] as const;
export const DRILL_STATUSES = ["OPEN", "CLOSED"] as const;

export const createDrillSchema = z.object({
  vesselId: z.string().uuid("Vessel is required"),
  drillType: z.enum(DRILL_TYPES),
  drillDate: z
    .string()
    .min(1, "Date is required")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  scenario: z.string().trim().max(2000).optional().or(z.literal("")),
  participants: z.string().trim().max(2000).optional().or(z.literal("")),
  conductedBy: z.string().trim().max(200).optional().or(z.literal("")),
  observations: z.string().trim().max(5000).optional().or(z.literal("")),
});
