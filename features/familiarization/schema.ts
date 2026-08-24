import { z } from "zod";

// A single induction/familiarization session typically covers several SMS
// topics at once (e.g. new-crew induction touching CSP, BWMP, and SEEMP in
// one sitting) — logging happens as one dated batch across the topics
// actually covered, rather than one record at a time.
export const logFamiliarizationBatchSchema = z.object({
  vesselId: z.string().uuid("Vessel is required"),
  scheduleItemIds: z.array(z.string().uuid()).min(1, "Select at least one topic"),
  completedDate: z
    .string()
    .min(1, "Date is required")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  notedBy: z.string().trim().max(200).optional().or(z.literal("")),
  remarks: z.string().trim().max(2000).optional().or(z.literal("")),
});
