import { z } from "zod";
import { LIFECYCLE_TONE } from "@/lib/status";
import { humanize } from "@/lib/utils";

export const MEETING_STATUSES = ["DRAFT", "REPORTED", "CLOSED"] as const;

/** App-wide OPEN/UNDER_REVIEW/CLOSED color standard — DRAFT (still being
 * edited by the vessel) is OPEN; REPORTED (awaiting the office) is UNDER_REVIEW. */
export function meetingStatusTone(status: string): "success" | "warning" | "danger" {
  if (status === "CLOSED") return LIFECYCLE_TONE.CLOSED;
  if (status === "DRAFT") return LIFECYCLE_TONE.OPEN;
  return LIFECYCLE_TONE.UNDER_REVIEW; // REPORTED — awaiting the office's review/close
}

/** Status badge text — REPORTED reads as "Waiting for Response" so it flags
 * the office that the vessel is waiting on them, not just a neutral state name. */
export function meetingStatusLabel(status: string): string {
  if (status === "REPORTED") return "Waiting for Response";
  return humanize(status);
}

export const COMMITTEE_TYPES = [
  "SAFETY",
  "MAINTENANCE",
  "HEALTH_HYGIENE",
  "SHIPBOARD_MANAGEMENT_TEAM",
  "OTHERS",
] as const;
export type CommitteeTypeValue = (typeof COMMITTEE_TYPES)[number];

export const COMMITTEE_TYPE_LABELS: Record<CommitteeTypeValue, string> = {
  SAFETY: "Safety Committee",
  MAINTENANCE: "Maintenance Committee",
  HEALTH_HYGIENE: "Health & Hygiene Committee",
  SHIPBOARD_MANAGEMENT_TEAM: "Shipboard Management Team",
  OTHERS: "Others / Extraordinary Meeting",
};

// Fixed committee composition per ADM-04 sec. 3 — shown as a reference next
// to the type picker so the Master knows who should be in the room.
export const COMMITTEE_COMPOSITION: Record<Exclude<CommitteeTypeValue, "OTHERS">, string> = {
  SAFETY: "Master (Chairman), C/O (In charge), 2/E (Member), + 1 deck & 1 engine rep",
  MAINTENANCE: "Master (Chairman), C/E (In charge), + 1 deck & 1 engine rep",
  HEALTH_HYGIENE: "Master (Chairman), C/O (In charge), C/E, 2/O, 4/E, Ch/Cook (Members)",
  SHIPBOARD_MANAGEMENT_TEAM: "Master (Team Leader), C/O, C/E, 2/E (Members)",
};

export type AgendaTemplateItem = { code: string; label: string };

// ADM-04 sec. 5 — fixed agenda per committee type. "OTHERS" has no template;
// its items are freely authored by the user instead (see the "Others" add-row
// in the create/edit forms).
export const AGENDA_TEMPLATES: Record<Exclude<CommitteeTypeValue, "OTHERS">, AgendaTemplateItem[]> = {
  SAFETY: [
    { code: "A", label: "Previous minutes meeting — reading of the previous meeting minutes and confirmation that all pending items have been completed." },
    { code: "B", label: "Accident/Incident discussion — discussions on any accidents/incidents that have occurred on the ship or in the fleet, and the plan of action to prevent repetition." },
    { code: "C", label: "Safe practices and environmental protection — safety practices that enhance safety culture (PPE, permits, risk assessment, etc.)." },
    { code: "D", label: "Near Miss / Non-Conformity issues — discussion on any reported near miss incidents on board." },
    { code: "E", label: "Crew trainings, CBT's and drills — progress of CBT, outcome of drills carried out, and next schedule of drills." },
    { code: "F", label: "Circulars and memorandums — safety circulars, memorandum notifications & experience feedbacks received since last meeting." },
    { code: "G", label: "Result of safety inspection — results of the ship's safety committee inspection, including action needed to correct observations found." },
    { code: "H", label: "Topics that require Company attention — requisition, crew requirements, expiring documents, certificates, etc." },
    { code: "I", label: "Others" },
  ],
  MAINTENANCE: [
    { code: "A", label: "PMS schedule for the next month — discussion on outstanding PMS and reason for such." },
    { code: "B", label: "Unplanned / unscheduled maintenance." },
    { code: "C", label: "Care and maintenance of critical equipment and spares." },
    { code: "D", label: "Major repair / drydocking." },
    { code: "E", label: "Care and maintenance of SOLAS fittings on board and records." },
    { code: "F", label: "Others" },
  ],
  HEALTH_HYGIENE: [
    { code: "A", label: "Cleanliness of galley, crew cabins, mess halls, hospital room, toilets, bathrooms, laundry room and others." },
    { code: "B", label: "Quality / quantity of drinking water and food." },
    { code: "C", label: "Crew physical condition." },
    { code: "D", label: "Others" },
  ],
  SHIPBOARD_MANAGEMENT_TEAM: [
    { code: "A", label: "Plan for undertaking major tasks — survey, safety inspection, audit, SIRE inspection, etc." },
    { code: "B", label: "Status of resources available and required office assistance." },
    { code: "C", label: "Plans for the upcoming regulation." },
    { code: "D", label: "Vessel performance — speed and fuel consumption." },
    { code: "E", label: "Discussion on cosmetic appearance improvements." },
    { code: "F", label: "Others" },
  ],
};

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

// Agenda rows travel as parallel arrays (same technique as Incident's SOF
// Time/Event rows) — every array is index-paired: agendaLabel[i] is the row
// whose committeeType is agendaCommitteeType[i], etc. agendaId is only used
// on update (empty string = new row to create, e.g. a follow-up Others topic).
const shipAgendaArrays = {
  agendaId: z.array(z.string()).default([]),
  agendaCommitteeType: z.array(z.enum(COMMITTEE_TYPES)).default([]),
  agendaCode: z.array(z.string()).default([]),
  agendaLabel: z.array(z.string()).default([]),
  agendaDetails: z.array(z.string()).default([]),
};

export const createCommitteeMeetingSchema = z.object({
  vesselId: z.string().uuid().optional().or(z.literal("")),
  position: optionalText(200),
  meetingDate: z
    .string()
    .min(1, "Date is required")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  meetingTime: optionalText(60),
  chairman: optionalText(200),
  inCharge: optionalText(200),
  members: optionalText(3000),
  inAttendance: optionalText(3000),
  forAcknowledgement: optionalText(2000),
  ...shipAgendaArrays,
});

/** Vessel-only, full edit of its own meeting — only ever allowed while status = DRAFT. */
export const updateDraftMeetingSchema = createCommitteeMeetingSchema.extend({
  meetingId: z.string().uuid(),
});

/** Office-only — one overall reply PER committee type present in the
 * meeting; only ever allowed while status = REPORTED. typeRemarksType[i]/
 * typeRemarksText[i] are index-paired, same convention as the agenda arrays
 * above — a combined Safety + Health & Hygiene meeting gets two separate
 * remarks, not one shared blob. */
export const officeReviewMeetingSchema = z.object({
  meetingId: z.string().uuid(),
  typeRemarksType: z.array(z.enum(COMMITTEE_TYPES)).default([]),
  typeRemarksText: z.array(z.string()).default([]),
});
