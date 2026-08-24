import { z } from "zod";

export const createCrewFamiliarizationSchema = z.object({
  vesselId: z.string().uuid("Vessel is required"),
  // Free text, not one name — this induction is a group session, not filed
  // per individual crew member.
  attendees: z.string().trim().min(1, "List who attended").max(2000),
  cycleStartDate: z
    .string()
    .min(1, "Cycle start date is required")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  supervisedBy: z.string().trim().max(200).optional().or(z.literal("")),
});

// Create a new induction AND log its first week in one submit — so an induction
// (and its ref number) only exists once a real familiarization is recorded, not
// on an empty "New Induction" click.
export const createAndLogFamiliarizationSchema = z.object({
  vesselId: z.string().uuid("Vessel is required"),
  attendees: z.string().trim().min(1, "List who attended").max(2000),
  supervisedBy: z.string().trim().max(200).optional().or(z.literal("")),
  details: z.string().trim().max(4000).optional().or(z.literal("")),
  cycleStartDate: z
    .string()
    .min(1, "Cycle start date is required")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  week: z.coerce.number().int().min(1).max(8),
  completedDate: z
    .string()
    .min(1, "Date is required")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  checkedItemIds: z.array(z.string().uuid()).min(1, "Tick at least one item covered"),
});

// Save the whole familiarization record at once: header fields + the full set
// of ticked items (a date is applied to items newly ticked here).
export const saveFamiliarizationRecordSchema = z.object({
  crewFamiliarizationId: z.string().uuid(),
  vesselId: z.string().uuid("Vessel is required"),
  attendees: z.string().trim().min(1, "List who attended").max(2000),
  supervisedBy: z.string().trim().max(200).optional().or(z.literal("")),
  details: z.string().trim().max(4000).optional().or(z.literal("")),
  completedDate: z
    .string()
    .min(1, "Date is required")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  checkedItemIds: z.array(z.string().uuid()),
});

export const setLsaFfeItemDateSchema = z.object({
  crewFamiliarizationId: z.string().uuid(),
  lsaFfeItemId: z.string().uuid(),
  // Empty string clears the record (item not yet covered).
  completedDate: z.string(),
});

// Log familiarization one week at a time: pick a week, tick the items covered
// that week, one date for all. Items in the week that were ticked are marked
// done (with the date); items left unticked that had been done are cleared.
export const logLsaFfeWeekSchema = z.object({
  crewFamiliarizationId: z.string().uuid(),
  week: z.coerce.number().int().min(1).max(8),
  completedDate: z
    .string()
    .min(1, "Date is required")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  // The item ids ticked as covered this week (may be empty to clear the week).
  checkedItemIds: z.array(z.string().uuid()),
  // Session details, editable straight from the week form (they belong to the
  // whole induction, not one week).
  vesselId: z.string().uuid("Vessel is required"),
  attendees: z.string().trim().min(1, "List who attended").max(2000),
  supervisedBy: z.string().trim().max(200).optional().or(z.literal("")),
  details: z.string().trim().max(4000).optional().or(z.literal("")),
});
