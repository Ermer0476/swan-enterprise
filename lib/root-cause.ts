// ─── Root cause classification — shared across modules ────────────────────
//  Originated in Incidents; Near Miss (and any future module) reuses the same
//  categories/labels so root cause reporting stays consistent company-wide.

export const ROOT_CAUSE_CATEGORIES = [
  "PROCESS_METHODS",
  "HUMAN_FACTORS",
  "EQUIPMENT_SOFTWARE",
  "MATERIALS",
  "MEASUREMENT_INFORMATION",
  "ENVIRONMENT_WORK_CONDITIONS",
  "MANAGEMENT_GOVERNANCE",
] as const;

export const ROOT_CAUSE_LABELS: Record<(typeof ROOT_CAUSE_CATEGORIES)[number], string> = {
  PROCESS_METHODS: "Process / Methods",
  HUMAN_FACTORS: "Human Factors",
  EQUIPMENT_SOFTWARE: "Equipment / Software",
  MATERIALS: "Materials",
  MEASUREMENT_INFORMATION: "Measurement / Information",
  ENVIRONMENT_WORK_CONDITIONS: "Environment / Work Conditions",
  MANAGEMENT_GOVERNANCE: "Management / Governance",
};

export const HUMAN_FACTORS = [
  "FATIGUE",
  "WORKLOAD_MULTITASKING",
  "SITUATIONAL_AWARENESS",
  "COMMUNICATION_BREAKDOWN",
  "DECISION_MAKING_PRESSURE",
  "CULTURAL_SPEAKING_UP",
] as const;

export const HUMAN_FACTOR_LABELS: Record<(typeof HUMAN_FACTORS)[number], string> = {
  FATIGUE: "Fatigue",
  WORKLOAD_MULTITASKING: "Workload / multitasking",
  SITUATIONAL_AWARENESS: "Situational awareness",
  COMMUNICATION_BREAKDOWN: "Communication breakdown (Bridge/Engine/Shore)",
  DECISION_MAKING_PRESSURE: "Decision-making under pressure",
  CULTURAL_SPEAKING_UP: "Cultural factors / speaking-up",
};

/** Max number of contributing human factors (enforced in form + server). */
export const MAX_CONTRIBUTING_FACTORS = 2;
