import { z } from "zod";

export const DOCUMENT_CATEGORIES = [
  "FORM",
  "CHECKLIST",
  "CERTIFICATE",
  "MANUAL",
  "PROCEDURE",
  "OTHER",
] as const;
export const DOCUMENT_STATUSES = ["DRAFT", "APPROVED", "SUPERSEDED"] as const;

export const createDocumentSchema = z.object({
  title: z.string().trim().min(3, "Title is required").max(200),
  vesselId: z.string().uuid().optional().or(z.literal("")),
  category: z.enum(DOCUMENT_CATEGORIES),
  version: z.string().trim().max(30).optional().or(z.literal("")),
  issueDate: z
    .string()
    .min(1, "Date is required")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  reviewDate: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Invalid date"),
  owner: z.string().trim().max(200).optional().or(z.literal("")),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
});
