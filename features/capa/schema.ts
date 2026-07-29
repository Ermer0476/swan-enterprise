import { z } from "zod";

export const CAPA_KINDS = ["CORRECTIVE", "PREVENTIVE"] as const;
export const CAPA_STATUSES = ["OPEN", "IN_PROGRESS", "CLOSED"] as const;

/** Prefix used for the auto-numbered CAPA ID, e.g. "CA-01" / "PA-01". */
export const CAPA_PREFIX: Record<(typeof CAPA_KINDS)[number], string> = {
  CORRECTIVE: "CA",
  PREVENTIVE: "PA",
};

export const addCapaSchema = z.object({
  entityType: z.string().trim().min(1),
  entityId: z.string().uuid(),
  kind: z.enum(CAPA_KINDS),
  action: z.string().trim().min(3, "Action is required").max(2000),
  responsible: z.string().trim().max(200).optional().or(z.literal("")),
  targetDate: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Invalid date"),
});

export const updateCapaSchema = z.object({
  id: z.string().uuid(),
  action: z.string().trim().min(3, "Action is required").max(2000),
  responsible: z.string().trim().max(200).optional().or(z.literal("")),
  targetDate: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Invalid date"),
  status: z.enum(CAPA_STATUSES),
  closedDate: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Invalid date"),
});
