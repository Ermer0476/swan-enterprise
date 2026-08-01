// ─── Root cause classification — shared across modules ────────────────────
//  Originated in Incidents; Near Miss/HOR, PSC, NCR, audits and SIRE all
//  reuse the same categories/sub-categories/labels so root cause reporting
//  stays consistent company-wide. Each category has its own flat sub-cause
//  list (5M+E style — matches how ECFA/RCA forms are filled in practice: one
//  root cause category, one sub-cause, no nested primary/contributing tiers).

export const ROOT_CAUSE_CATEGORIES = [
  "PROCESS_METHODS",
  "HUMAN_FACTORS",
  "EQUIPMENT_SOFTWARE",
  "MATERIALS",
  "MEASUREMENT_INFORMATION",
  "ENVIRONMENT_WORK_CONDITIONS",
  "MANAGEMENT_GOVERNANCE",
] as const;

export type RootCauseCategoryValue = (typeof ROOT_CAUSE_CATEGORIES)[number];

export const ROOT_CAUSE_LABELS: Record<RootCauseCategoryValue, string> = {
  PROCESS_METHODS: "Process / Methods",
  HUMAN_FACTORS: "Human Factors",
  EQUIPMENT_SOFTWARE: "Equipment / Software",
  MATERIALS: "Materials",
  MEASUREMENT_INFORMATION: "Measurement / Information",
  ENVIRONMENT_WORK_CONDITIONS: "Environment / Work Conditions",
  MANAGEMENT_GOVERNANCE: "Management / Governance",
};

// One-line description of what drives each category — the "is this the
// right bucket?" test, shown alongside the category picker.
export const ROOT_CAUSE_DESCRIPTIONS: Record<RootCauseCategoryValue, string> = {
  PROCESS_METHODS:
    "The procedure or control itself is the driver — a missing/unclear step, outdated revision, no verification gate, missing checklist item, or a PMS execution/coverage gap.",
  HUMAN_FACTORS:
    "A sufficient procedure existed but was not followed due to human-performance conditions. Frame the output as an assurance/verification reinforcement — never as crew fault.",
  EQUIPMENT_SOFTWARE:
    "Equipment/system capability, reliability, configuration, calibration, or software access is the main driver (item was maintained but still failed).",
  MATERIALS:
    "A consumable, spare, or material's spec, quality, or suitability caused the issue (not the tool or system itself).",
  MEASUREMENT_INFORMATION:
    "The gap is criteria, feedback, or visibility — no acceptance criteria, no alert threshold, weak monitoring signal, or a requirement not translated into a measurable check.",
  ENVIRONMENT_WORK_CONDITIONS:
    "Workplace conditions materially increased the likelihood of error — weather, access, or time-window constraints.",
  MANAGEMENT_GOVERNANCE:
    "The required control depends on management-system elements — ownership, oversight, resources, escalation, or policy-level control.",
};

export const ROOT_CAUSE_SUBCATEGORIES: Record<RootCauseCategoryValue, readonly string[]> = {
  PROCESS_METHODS: [
    "PROCEDURE_NOT_FOLLOWED",
    "PROCEDURE_INADEQUATE",
    "SOP_NOT_AVAILABLE",
    "CHECKLIST_NOT_USED",
    "UNCONTROLLED_OUTDATED_REVISION",
    "PMS_JOB_OVERDUE",
    "EQUIPMENT_NOT_COVERED_IN_PMS",
  ],
  // Internal classification tags only — blame labels are for internal
  // trending. Any vetter-facing output should convert these to: "assurance/
  // verification step not fully effective at the time — reinforcement applied."
  HUMAN_FACTORS: [
    "SITUATIONAL_AWARENESS_REDUCED",
    "WORKLOAD_MULTITASKING_HIGH",
    "FATIGUE_REST_HOUR",
    "COMMUNICATION_BREAKDOWN",
    "DECISION_MAKING_TIME_PRESSURE",
    "CULTURAL_SPEAKING_UP_BARRIER",
  ],
  EQUIPMENT_SOFTWARE: [
    "EQUIPMENT_FAILURE",
    "SOFTWARE_ISSUE",
    "CALIBRATION",
    "WRONG_SETTINGS",
    "DESIGN_ERGONOMIC_LIMITATION",
    "CONNECTIVITY_DATA_SYNC_LOSS",
    "ALARM_BYPASSED_SUPPRESSED",
  ],
  MATERIALS: [
    "WRONG_MATERIAL",
    "DEFECTIVE_MATERIAL",
    "MATERIAL_UNAVAILABLE",
    "EXPIRED_SHELF_LIFE",
    "INCORRECT_MISSING_CERTIFICATION",
    "INCOMPATIBLE_MATERIAL_SUBSTITUTION",
  ],
  MEASUREMENT_INFORMATION: [
    "NO_ACCEPTANCE_CRITERIA",
    "MISSING_INFORMATION",
    "INCORRECT_MEASUREMENT",
    "NO_ALERT_THRESHOLD",
    "RECORD_NOT_TRACEABLE",
    "DOCUMENTATION_NOT_UPDATED",
    "TREND_NOT_MONITORED",
  ],
  ENVIRONMENT_WORK_CONDITIONS: [
    "WEATHER",
    "POOR_LIGHTING",
    "HIGH_TEMPERATURE",
    "CONFINED_SPACE",
    "NOISE_VIBRATION",
    "RESTRICTED_ACCESS_ERGONOMICS",
    "SIMOPS_PORT_TIME_WINDOW",
  ],
  MANAGEMENT_GOVERNANCE: [
    "MOC_NOT_CONDUCTED",
    "SUPERVISION_OVERSIGHT_NOT_EFFECTIVE",
    "PLANNING_INADEQUATE",
    "TRAINING_COMPETENCE_GAP",
    "RESOURCE_MANNING_ALLOCATION",
    "RISK_ASSESSMENT_INADEQUATE",
    "ASSURANCE_SAMPLING_ESCALATION_NOT_DEFINED",
  ],
};

export const ROOT_CAUSE_SUBCATEGORY_LABELS: Record<RootCauseCategoryValue, Record<string, string>> = {
  PROCESS_METHODS: {
    PROCEDURE_NOT_FOLLOWED: "Procedure not followed / not verified before inspection",
    PROCEDURE_INADEQUATE: "Procedure inadequate — missing or unclear step",
    SOP_NOT_AVAILABLE: "SOP not available (no controlled procedure exists)",
    CHECKLIST_NOT_USED: "Checklist not used or incomplete",
    UNCONTROLLED_OUTDATED_REVISION: "Uncontrolled / outdated revision in circulation",
    PMS_JOB_OVERDUE: "PMS job overdue — not executed to schedule",
    EQUIPMENT_NOT_COVERED_IN_PMS: "Equipment or check not covered in PMS",
  },
  HUMAN_FACTORS: {
    SITUATIONAL_AWARENESS_REDUCED: "Situational awareness reduced",
    WORKLOAD_MULTITASKING_HIGH: "Workload / multitasking high at the time",
    FATIGUE_REST_HOUR: "Fatigue / rest-hour concern",
    COMMUNICATION_BREAKDOWN: "Communication breakdown (Bridge / Engine / Shore)",
    DECISION_MAKING_TIME_PRESSURE: "Decision-making under time pressure",
    CULTURAL_SPEAKING_UP_BARRIER: "Cultural factor / speaking-up barrier",
  },
  EQUIPMENT_SOFTWARE: {
    EQUIPMENT_FAILURE: "Equipment failure — degradation despite maintenance",
    SOFTWARE_ISSUE: "Software / system fault or access issue",
    CALIBRATION: "Calibration out of date / sensor drift",
    WRONG_SETTINGS: "Wrong settings / configuration drift after update",
    DESIGN_ERGONOMIC_LIMITATION: "Design or ergonomic limitation",
    CONNECTIVITY_DATA_SYNC_LOSS: "Connectivity / data-sync loss",
    ALARM_BYPASSED_SUPPRESSED: "Alarm bypassed or suppressed",
  },
  MATERIALS: {
    WRONG_MATERIAL: "Wrong material / incorrect grade",
    DEFECTIVE_MATERIAL: "Defective or substandard material",
    MATERIAL_UNAVAILABLE: "Material / spare unavailable when required",
    EXPIRED_SHELF_LIFE: "Expired shelf-life",
    INCORRECT_MISSING_CERTIFICATION: "Incorrect or missing certification",
    INCOMPATIBLE_MATERIAL_SUBSTITUTION: "Incompatible material substitution",
  },
  MEASUREMENT_INFORMATION: {
    NO_ACCEPTANCE_CRITERIA: "No defined acceptance criteria",
    MISSING_INFORMATION: "Missing or incomplete information",
    INCORRECT_MEASUREMENT: "Incorrect measurement / wrong data",
    NO_ALERT_THRESHOLD: "No alert or threshold set",
    RECORD_NOT_TRACEABLE: "Record not traceable / not controlled",
    DOCUMENTATION_NOT_UPDATED: "Documentation not updated",
    TREND_NOT_MONITORED: "Trend not monitored",
  },
  ENVIRONMENT_WORK_CONDITIONS: {
    WEATHER: "Weather / sea state / vessel motion",
    POOR_LIGHTING: "Poor lighting",
    HIGH_TEMPERATURE: "High temperature / heat stress",
    CONFINED_SPACE: "Confined space",
    NOISE_VIBRATION: "Noise / vibration",
    RESTRICTED_ACCESS_ERGONOMICS: "Restricted access / ergonomics",
    SIMOPS_PORT_TIME_WINDOW: "SIMOPS or port time-window constraint",
  },
  MANAGEMENT_GOVERNANCE: {
    MOC_NOT_CONDUCTED: "MOC (Management of Change) not conducted",
    SUPERVISION_OVERSIGHT_NOT_EFFECTIVE: "Supervision / oversight not fully effective",
    PLANNING_INADEQUATE: "Planning inadequate",
    TRAINING_COMPETENCE_GAP: "Training / competence matrix gap",
    RESOURCE_MANNING_ALLOCATION: "Resource / manning allocation",
    RISK_ASSESSMENT_INADEQUATE: "Risk assessment inadequate or not conducted",
    ASSURANCE_SAMPLING_ESCALATION_NOT_DEFINED: "Assurance sampling / escalation not defined",
  },
};

/** Single-line "Category - Sub-category" display, used everywhere root
 * cause is shown read-only (detail pages, reports) so category and
 * sub-category always read together instead of as separate fields. */
export function formatRootCause(
  category: RootCauseCategoryValue | null | undefined,
  subCategory: string | null | undefined,
): string {
  if (!category) return "—";
  const categoryLabel = ROOT_CAUSE_LABELS[category];
  if (!subCategory) return categoryLabel;
  const subLabel = ROOT_CAUSE_SUBCATEGORY_LABELS[category][subCategory] ?? subCategory;
  return `${categoryLabel} - ${subLabel}`;
}
