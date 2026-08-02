import { z } from "zod";
import { ROOT_CAUSE_CATEGORIES } from "@/lib/root-cause";

export const INSPECTION_STATUSES = ["OPEN", "IN_PROGRESS", "CLOSED"] as const;

export const SIRE_INSPECTION_TYPES = [
  "LOADING_OPERATION",
  "DISCHARGING_OPERATION",
  "BUNKERING",
  "IDLE",
] as const;
export const SIRE_INSPECTION_TYPE_LABELS: Record<(typeof SIRE_INSPECTION_TYPES)[number], string> = {
  LOADING_OPERATION: "Loading Operation",
  DISCHARGING_OPERATION: "Discharging Operation",
  BUNKERING: "Bunkering",
  IDLE: "Idle",
};

export const SIRE_OVERALL_RESULTS = ["SATISFACTORY", "OBSERVATIONS", "MAJOR_CONCERN"] as const;
export const SIRE_OVERALL_RESULT_LABELS: Record<(typeof SIRE_OVERALL_RESULTS)[number], string> = {
  SATISFACTORY: "Satisfactory",
  OBSERVATIONS: "Observation(s)",
  MAJOR_CONCERN: "Major Concern",
};

export const SIRE_OBSERVATION_STATUSES = [
  "OPEN",
  "ONGOING",
  "PENDING_VERIFICATION",
  "CLOSED",
] as const;
export const SIRE_OBSERVATION_STATUS_LABELS: Record<(typeof SIRE_OBSERVATION_STATUSES)[number], string> = {
  OPEN: "Open",
  ONGOING: "Ongoing",
  PENDING_VERIFICATION: "Pending Verification",
  CLOSED: "Closed",
};

// SIRE 2.0 observation category.
export const SIRE_OBSERVATION_CATEGORIES = ["HARDWARE", "PROCESS", "HUMAN", "PHOTOGRAPH"] as const;
export const SIRE_OBSERVATION_CATEGORY_LABELS: Record<(typeof SIRE_OBSERVATION_CATEGORIES)[number], string> = {
  HARDWARE: "Hardware",
  PROCESS: "Process",
  HUMAN: "Human",
  PHOTOGRAPH: "Photograph",
};

// OCIMF VIQ chapters.
export const VIQ_CHAPTERS = [
  { no: 1, title: "General Information" },
  { no: 2, title: "Certification and Documentation" },
  { no: 3, title: "Crew Management" },
  { no: 4, title: "Navigation and Communications" },
  { no: 5, title: "Safety Management" },
  { no: 6, title: "Pollution Prevention" },
  { no: 7, title: "Maritime Security" },
  { no: 8, title: "Cargo and Ballast Systems (Petroleum/Chemical/LPG/LNG variant)" },
  { no: 9, title: "Mooring" },
  { no: 10, title: "Engine and Steering Compartments" },
  { no: 11, title: "General Appearance and Condition" },
  { no: 12, title: "Ice Operations (only applicable when operating in ice areas)" },
] as const;
export const VIQ_CHAPTER_TITLES: Record<number, string> = Object.fromEntries(
  VIQ_CHAPTERS.map((c) => [c.no, c.title]),
);

export const createSireSchema = z.object({
  vesselId: z.string().uuid().optional().or(z.literal("")),
  inspectingCompany: z
    .string()
    .trim()
    .min(2, "Inspecting company is required")
    .max(200),
  inspectorName: z.string().trim().min(2, "Inspector name is required").max(200),
  port: z.string().trim().max(200).optional().or(z.literal("")),
  inspectionDate: z
    .string()
    .min(1, "Date is required")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  inspectionType: z.enum(SIRE_INSPECTION_TYPES).optional().or(z.literal("")),
  overallResult: z.enum(SIRE_OVERALL_RESULTS).optional().or(z.literal("")),
  sireVersion: z.string().trim().max(20).optional().or(z.literal("")),
  summary: z.string().trim().max(10000).optional().or(z.literal("")),
});

const optionalDate = z
  .string()
  .optional()
  .or(z.literal(""))
  .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Invalid date");

export const addObservationSchema = z.object({
  inspectionId: z.string().uuid(),
  chapter: z.coerce.number().int().min(1).max(12).optional().or(z.literal("")),
  // Required — feeds the SIRE KPI, so an observation can't be saved without
  // it (a missing value here would silently drop out of that reporting).
  category: z.enum(SIRE_OBSERVATION_CATEGORIES, { message: "Category is required" }),
  viqRef: z.string().trim().max(40).optional().or(z.literal("")),
  question: z.string().trim().max(10000).optional().or(z.literal("")),
  observation: z.string().trim().min(3, "Finding is required").max(10000),
  immediateCause: z.string().trim().max(10000).optional().or(z.literal("")),
  rootCauseCategory: z.enum(ROOT_CAUSE_CATEGORIES, { message: "Root cause category is required" }),
  rootCauseSubCategory: z.string().trim().max(60).optional().or(z.literal("")),
  rootCause: z.string().trim().max(10000).optional().or(z.literal("")),
  correctiveAction: z.string().trim().max(10000).optional().or(z.literal("")),
  preventiveMeasure: z.string().trim().max(10000).optional().or(z.literal("")),
  responsiblePersonId: z.string().uuid().optional().or(z.literal("")),
  targetDate: optionalDate,
  actualCompletionDate: optionalDate,
  status: z.enum(SIRE_OBSERVATION_STATUSES).default("OPEN"),
  verifiedById: z.string().uuid().optional().or(z.literal("")),
});

export const updateObservationSchema = addObservationSchema
  .omit({ inspectionId: true })
  .extend({ observationId: z.string().uuid() });

export const addCommentSchema = z.object({
  observationId: z.string().uuid(),
  body: z.string().trim().min(1, "Comment can't be empty").max(4000),
});
