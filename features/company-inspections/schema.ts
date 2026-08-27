import { z } from "zod";
import { ROOT_CAUSE_CATEGORIES } from "@/lib/root-cause";
import { SIRE_OBSERVATION_CATEGORIES } from "@/features/sire/schema";

export {
  SIRE_OBSERVATION_CATEGORIES,
  SIRE_OBSERVATION_CATEGORY_LABELS,
  SIRE_OBSERVATION_CATEGORY_ICONS,
  VIQ_CHAPTERS,
  VIQ_CHAPTER_TITLES,
} from "@/features/sire/schema";

export const INSPECTION_STATUSES = ["OPEN", "IN_PROGRESS", "CLOSED"] as const;

// Which discipline the inspection covers — Technical (machinery, equipment
// condition) vs Safety (procedures, PPE, safe working practices).
export const COMPANY_INSPECTION_TYPES = ["TECHNICAL", "SAFETY"] as const;
export const COMPANY_INSPECTION_TYPE_LABELS: Record<(typeof COMPANY_INSPECTION_TYPES)[number], string> = {
  TECHNICAL: "Technical",
  SAFETY: "Safety",
};

// Port Visit (alongside/berth) vs Sailing Visit (underway).
export const COMPANY_INSPECTION_VISIT_KINDS = ["PORT_VISIT", "SAILING_VISIT"] as const;
export const COMPANY_INSPECTION_VISIT_KIND_LABELS: Record<(typeof COMPANY_INSPECTION_VISIT_KINDS)[number], string> = {
  PORT_VISIT: "Port Visit",
  SAILING_VISIT: "Sailing Visit",
};

export const createCompanyInspectionSchema = z.object({
  vesselId: z.string().uuid().optional().or(z.literal("")),
  inspectionType: z.enum(COMPANY_INSPECTION_TYPES).optional().or(z.literal("")),
  visitKind: z.enum(COMPANY_INSPECTION_VISIT_KINDS).optional().or(z.literal("")),
  inspectorName: z.string().trim().max(200).optional().or(z.literal("")),
  port: z.string().trim().max(200).optional().or(z.literal("")),
  inspectionDate: z
    .string()
    .min(1, "Date is required")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  summary: z.string().trim().max(10000).optional().or(z.literal("")),
});

// For filling in header details on an inspection that was created before
// they were captured, or was created without them. Vessel/date aren't
// editable here — changing those has wider implications (refNo prefix,
// exposure-hours-style history) that a quick "fill in what's missing" form
// shouldn't touch.
export const updateCompanyInspectionDetailsSchema = z.object({
  inspectionId: z.string().uuid(),
  inspectionType: z.enum(COMPANY_INSPECTION_TYPES).optional().or(z.literal("")),
  visitKind: z.enum(COMPANY_INSPECTION_VISIT_KINDS).optional().or(z.literal("")),
  inspectorName: z.string().trim().max(200).optional().or(z.literal("")),
  port: z.string().trim().max(200).optional().or(z.literal("")),
});

// Deliberately lean compared to SireObservation — Observation, Root Cause and
// an on-the-spot Immediate Corrective Action. Any longer-running follow-up is
// tracked separately in the shared CAPA register, not here.
export const addObservationSchema = z.object({
  inspectionId: z.string().uuid(),
  chapter: z.coerce.number().int().min(1).max(12).optional().or(z.literal("")),
  category: z.enum(SIRE_OBSERVATION_CATEGORIES).optional().or(z.literal("")),
  viqRef: z.string().trim().max(20).optional().or(z.literal("")),
  observation: z.string().trim().min(3, "Observation is required").max(10000),
  immediateCause: z.string().trim().max(10000).optional().or(z.literal("")),
  rootCauseCategory: z.enum(ROOT_CAUSE_CATEGORIES).optional().or(z.literal("")),
  rootCauseSubCategory: z.string().trim().max(60).optional().or(z.literal("")),
  rootCause: z.string().trim().max(10000).optional().or(z.literal("")),
  immediateCorrectiveAction: z.string().trim().max(10000).optional().or(z.literal("")),
});

export const updateObservationSchema = addObservationSchema
  .omit({ inspectionId: true })
  .extend({ observationId: z.string().uuid() });

// Company Inspection KPI dashboard target: average observations per
// inspection, fleet-wide — same pattern as SIRE's target.
export const DEFAULT_CINSP_OBSERVATION_TARGET = 3.0;

export const updateCinspTargetSchema = z.object({
  avgObservationTarget: z.coerce.number().positive("Target must be greater than 0"),
});

// The sub-category membership check is NOT a superRefine here: the allowed set
// is the office-editable reference list (root-cause-subcategory:<CATEGORY>), which
// needs the company id and a DB read, so it lives in the save action (∪ the
// value already persisted on the row being edited).
export const observationRootCauseSchema = z
  .object({
    observationId: z.string().uuid(),
    rootCauseCategory: z.enum(ROOT_CAUSE_CATEGORIES),
    rootCauseSubCategory: z.string().trim().min(1, "Select the root cause sub-category"),
    rootCause: z.string().trim().max(10000).optional().or(z.literal("")),
  });
