import { z } from "zod";

export const MEETING_TYPES = ["SAFETY_COMMITTEE", "OFFICE_SAFETY", "MANAGEMENT_REVIEW"] as const;
export const MEETING_STATUSES = ["OPEN", "CLOSED"] as const;

export const createMeetingSchema = z.object({
  vesselId: z.string().uuid().optional().or(z.literal("")),
  meetingType: z.enum(MEETING_TYPES),
  meetingDate: z
    .string()
    .min(1, "Date is required")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  chairedBy: z.string().trim().max(200).optional().or(z.literal("")),
  attendees: z.string().trim().max(2000).optional().or(z.literal("")),
  agenda: z.string().trim().max(5000).optional().or(z.literal("")),
  minutes: z.string().trim().max(10000).optional().or(z.literal("")),
});
