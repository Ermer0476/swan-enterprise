import { z } from "zod";

export const CIRCULAR_CATEGORIES = [
  "SAFETY",
  "TECHNICAL",
  "OPERATIONAL",
  "HR",
  "REGULATORY",
  "OTHER",
] as const;

export const createCircularSchema = z.object({
  title: z.string().trim().min(3, "Title is required").max(200),
  vesselId: z.string().uuid().optional().or(z.literal("")),
  category: z.enum(CIRCULAR_CATEGORIES),
  issueDate: z
    .string()
    .min(1, "Date is required")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  body: z.string().trim().min(10, "Circular content is required").max(10000),
});
