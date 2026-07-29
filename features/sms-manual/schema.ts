import { z } from "zod";

/** Entity type key used to bind SMS documents to the workflow engine. */
export const SMS_ENTITY_TYPE = "SmsDocument";

// Department values mirror the Prisma DepartmentType enum.
export const DEPARTMENTS = [
  "EXECUTIVE",
  "MARINE",
  "TECHNICAL",
  "OPERATIONS",
  "CREWING",
  "PURCHASING",
  "ACCOUNTING",
  "ADMIN",
  "HR",
  "IT",
  "QHSE",
  "SHIPBOARD",
] as const;

export const createDocumentSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Document code is required")
    .max(40)
    .regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers and hyphens only"),
  title: z.string().trim().min(3, "Title is required").max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  category: z.string().trim().min(2, "Category is required").max(80),
  department: z.enum(DEPARTMENTS),
  content: z.string().trim().max(50000).optional().or(z.literal("")),
});

export const addRevisionSchema = z.object({
  documentId: z.string().uuid(),
  changeSummary: z.string().trim().min(3, "Describe what changed").max(2000),
  content: z.string().trim().max(50000).optional().or(z.literal("")),
});

export const reviewSchema = z.object({
  documentId: z.string().uuid(),
  comment: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type AddRevisionInput = z.infer<typeof addRevisionSchema>;
