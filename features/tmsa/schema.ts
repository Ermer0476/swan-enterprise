import { z } from "zod";

// The 19 TMSA 3 elements, in report order (base 1-13, sub-elements lettered).
export const TMSA_ELEMENTS = [
  "1", "1A", "2", "3", "3A", "4", "4A", "5", "6", "6A",
  "7", "8", "9", "9A", "10", "11", "12", "12A", "13",
] as const;

export const TMSA_FINDING_STATUSES = ["OPEN", "IN_PROGRESS", "CLOSED"] as const;
export type TmsaFindingStatusValue = (typeof TMSA_FINDING_STATUSES)[number];
export const TMSA_FINDING_STATUS_LABELS: Record<TmsaFindingStatusValue, string> = {
  OPEN: "OPEN",
  IN_PROGRESS: "IN PROGRESS",
  CLOSED: "CLOSED",
};

export const TMSA_COMPLIANCE_STATUSES = ["YES", "NO"] as const;
export type TmsaComplianceStatusValue = (typeof TMSA_COMPLIANCE_STATUSES)[number];

export const TMSA_RESPONSE_STATES = ["ON_OCIMF", "REVISED"] as const;
export type TmsaResponseStateValue = (typeof TMSA_RESPONSE_STATES)[number];

export const TMSA_FINDING_SOURCES = ["Internal", "Equinor", "Chevron", "RightShip"] as const;

// Fallback ordering for element codes like "1", "1A", "12A".
export function elementOrderKey(code: string): number {
  const base = parseInt(code, 10) || 0;
  const hasLetter = /[A-Za-z]/.test(code) ? 0.5 : 0;
  return base + hasLetter;
}

const optionalNumber = () =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : v), z.coerce.number().optional());

export const createFindingSchema = z.object({
  elementCode: z.enum(TMSA_ELEMENTS),
  stage: z.coerce.number().int().min(1).max(4).default(1),
  questionNo: optionalNumber(),
  source: z.string().trim().min(1).max(200).default("Internal"),
  auditYear: z.coerce.number().int().min(2000).max(2100).default(new Date().getUTCFullYear()),
  observation: z.string().trim().min(1, "Observation is required.").max(10000),
  correctiveAction: z.string().trim().optional().or(z.literal("")),
  responsible: z.string().trim().optional().or(z.literal("")),
  target: z.string().trim().optional().or(z.literal("")),
  status: z.enum(TMSA_FINDING_STATUSES).default("OPEN"),
});

export const updateFindingSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(TMSA_FINDING_STATUSES),
  correctiveAction: z.string().trim().optional().or(z.literal("")),
  responsible: z.string().trim().optional().or(z.literal("")),
  target: z.string().trim().optional().or(z.literal("")),
});

// Build the "element.stage.question" (or "element.stage") KPI reference used
// to cross-link a finding to a specific TmsaAssessment row.
export function kpiRefFor(elementCode: string, stage: number, questionNo: number): string {
  if (questionNo > 0) return `${elementCode}.${stage}.${questionNo}`;
  if (stage > 0) return `${elementCode}.${stage}`;
  return "";
}
