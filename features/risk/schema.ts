import { z } from "zod";

/** Entity type key used to bind Risk Assessment documents to the workflow engine. */
export const RISK_ENTITY_TYPE = "RiskAssessmentDocument";

export const RA_LEVELS = [1, 2, 3, 4, 5] as const;
export type RaLevel = (typeof RA_LEVELS)[number];

/** Company's documented Likelihood scale (RC-012) — history-based, not generic. */
export const LIKELIHOOD_SCALE_LABELS: Record<RaLevel, string> = {
  1: "1 — Never happened to any vessel",
  2: "2 — Happened somewhere, long time ago",
  3: "3 — Happens to other vessels every year",
  4: "4 — Happened to our fleet",
  5: "5 — Happened to THIS vessel",
};

export const SEVERITY_SCALE_LABELS: Record<RaLevel, string> = {
  1: "1 — Negligible",
  2: "2 — Minor",
  3: "3 — Moderate",
  4: "4 — Major",
  5: "5 — Catastrophic",
};

/** RF = Severity × Likelihood. */
export function computeRF(severity: number, likelihood: number): number {
  return severity * likelihood;
}

export type RiskBand = "GREEN" | "YELLOW" | "RED";

/** RC-012's own matrix: RF ≤ 6 = Green/ALARP, 7-14 = Yellow (additional
 * controls required), RF ≥ 15 = Red (do not start / Company approval). */
export function riskBand(rf: number): RiskBand {
  if (rf >= 15) return "RED";
  if (rf >= 7) return "YELLOW";
  return "GREEN";
}

export const RISK_CATEGORIES = [
  "Deck Operations",
  "Engine Room",
  "Cargo Operations",
  "Mooring Operations",
  "Enclosed Space Entry",
  "Hot Work",
  "Working Aloft",
  "Working Overside",
  "Bunkering",
  "General",
] as const;

export const REVIEW_TRIGGERS = [
  "ANNUAL_REVIEW_DUE",
  "REVIEW_PERIOD_EXPIRED",
  "REVISION_REQUESTED_BY_VESSEL",
  "INCIDENT_INVESTIGATION_RECOMMENDATION",
  "NEAR_MISS_RECOMMENDATION",
  "HAZARD_OBSERVATION_RECOMMENDATION",
  "SIRE_OBSERVATION",
  "PSC_DEFICIENCY",
  "INTERNAL_AUDIT_FINDING",
  "EXTERNAL_AUDIT_FINDING",
  "SMS_PROCEDURE_REVISED",
  "MANAGEMENT_REQUEST",
  "REGULATORY_CHANGE",
] as const;

export const REVIEW_TRIGGER_LABELS: Record<(typeof REVIEW_TRIGGERS)[number], string> = {
  ANNUAL_REVIEW_DUE: "Annual Review Due",
  REVIEW_PERIOD_EXPIRED: "Review Period Expired",
  REVISION_REQUESTED_BY_VESSEL: "Revision Requested by Vessel",
  INCIDENT_INVESTIGATION_RECOMMENDATION: "Incident Investigation Recommendation",
  NEAR_MISS_RECOMMENDATION: "Near Miss Recommendation",
  HAZARD_OBSERVATION_RECOMMENDATION: "Hazard Observation Recommendation",
  SIRE_OBSERVATION: "SIRE Observation",
  PSC_DEFICIENCY: "PSC Deficiency",
  INTERNAL_AUDIT_FINDING: "Internal Audit Finding",
  EXTERNAL_AUDIT_FINDING: "External Audit Finding",
  SMS_PROCEDURE_REVISED: "SMS Procedure Revised",
  MANAGEMENT_REQUEST: "Management Request",
  REGULATORY_CHANGE: "Regulatory Change",
};

export const REVIEW_FREQUENCY_MONTHS = [6, 12, 24] as const;

export const APPROVAL_LEVELS = ["LOCAL", "COMPANY_MANDATORY"] as const;
export const APPROVAL_LEVEL_LABELS: Record<(typeof APPROVAL_LEVELS)[number], string> = {
  LOCAL: "Local / SMC — no Company approval required",
  COMPANY_MANDATORY: "Company approval MANDATORY",
};

const levelField = z.coerce.number().int().min(1).max(5);

export const createDocumentSchema = z.object({
  title: z.string().trim().min(3, "Title is required").max(200),
  category: z.string().trim().min(2, "Category is required").max(80),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  vesselId: z.string().uuid().optional().or(z.literal("")),
  applicableVesselType: z.string().trim().max(80).optional().or(z.literal("")),
  reviewFrequencyMonths: z.coerce.number().int().min(1).max(120),
  smsProcedureRefs: z.string().trim().max(500).optional().or(z.literal("")),
  riskMatrixRef: z.string().trim().max(300).optional().or(z.literal("")),
  checklistsRequired: z.string().trim().max(300).optional().or(z.literal("")),
  approvalLevel: z.enum(APPROVAL_LEVELS),
});

export const addRevisionSchema = z.object({
  documentId: z.string().uuid(),
  changeSummary: z.string().trim().min(3, "Describe what changed").max(2000),
  reviewTrigger: z.enum(REVIEW_TRIGGERS).optional(),
  smsProcedureRefs: z.string().trim().max(500).optional().or(z.literal("")),
  riskMatrixRef: z.string().trim().max(300).optional().or(z.literal("")),
  checklistsRequired: z.string().trim().max(300).optional().or(z.literal("")),
  approvalLevel: z.enum(APPROVAL_LEVELS),
});

export const reviewSchema = z.object({
  documentId: z.string().uuid(),
  comment: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const hazardRowSchema = z.object({
  revisionId: z.string().uuid(),
  phase: z.string().trim().max(120).optional().or(z.literal("")),
  consequence: z.string().trim().min(3, "Describe the unwanted consequence").max(300),
  causes: z.string().trim().min(3, "Describe the possible causes / hazard factors").max(2000),
  severity: levelField,
  likelihood: levelField,
  existingControls: z.string().trim().min(3, "Existing controls are required").max(3000),
  additionalControls: z.string().trim().max(3000).optional().or(z.literal("")),
  resLikelihood: levelField.optional(),
  responsible: z.string().trim().max(200).optional().or(z.literal("")),
  isNew: z.coerce.boolean().optional(),
  ratingChangeNote: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const deleteHazardRowSchema = z.object({
  rowId: z.string().uuid(),
  documentId: z.string().uuid(),
});

export const updateHazardRowSchema = z.object({
  rowId: z.string().uuid(),
  phase: z.string().trim().max(120).optional().or(z.literal("")),
  consequence: z.string().trim().min(3, "Describe the unwanted consequence").max(300),
  causes: z.string().trim().min(3, "Describe the possible causes / hazard factors").max(2000),
  severity: levelField,
  likelihood: levelField,
  existingControls: z.string().trim().min(3, "Existing controls are required").max(3000),
  additionalControls: z.string().trim().max(3000).optional().or(z.literal("")),
  resLikelihood: levelField.optional(),
  responsible: z.string().trim().max(200).optional().or(z.literal("")),
});

export const executionSchema = z.object({
  documentId: z.string().uuid(),
  vesselId: z.string().uuid("Vessel is required"),
  jobName: z.string().trim().min(3, "Job / task name is required").max(200),
  conditionStatus: z.enum(["UNCHANGED", "CHANGED"]),
  changedConditionsNote: z.string().trim().max(2000).optional().or(z.literal("")),
  temporaryHazards: z.string().trim().max(2000).optional().or(z.literal("")),
  temporaryControls: z.string().trim().max(2000).optional().or(z.literal("")),
  toolboxAttendees: z.string().trim().max(2000).optional().or(z.literal("")),
  toolboxSigned: z.coerce.boolean().optional(),
});

export const revisionRequestSchema = z.object({
  documentId: z.string().uuid(),
  vesselId: z.string().uuid().optional().or(z.literal("")),
  reason: z.string().trim().min(10, "Explain the reason for this request").max(2000),
  reviewTrigger: z.enum(REVIEW_TRIGGERS),
});

export const decideRevisionRequestSchema = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(["APPROVED", "REJECTED"]),
  decisionNote: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type AddRevisionInput = z.infer<typeof addRevisionSchema>;
export type HazardRowInput = z.infer<typeof hazardRowSchema>;
export type ExecutionInput = z.infer<typeof executionSchema>;
export type RevisionRequestInput = z.infer<typeof revisionRequestSchema>;
