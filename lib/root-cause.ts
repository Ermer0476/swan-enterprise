// ─── Root cause classification — shared across modules ────────────────────
//  Originated in Incidents; Near Miss/HOR (and any future module) reuses the
//  same categories/sub-categories/labels so root cause reporting stays
//  consistent company-wide. Each category has its own flat sub-category list
//  (5M+E style — matches how ECFA/RCA forms are filled in practice: one root
//  cause category, one sub-cause, no nested primary/contributing tiers).

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

export const ROOT_CAUSE_SUBCATEGORIES: Record<RootCauseCategoryValue, readonly string[]> = {
  PROCESS_METHODS: [
    "PROCEDURE_NOT_FOLLOWED",
    "PROCEDURE_INADEQUATE",
    "SOP_NOT_AVAILABLE",
    "CHECKLIST_NOT_USED",
    "PROCESS_GAP",
  ],
  HUMAN_FACTORS: [
    "HUMAN_ERROR",
    "LACK_OF_ATTENTION",
    "FATIGUE",
    "COMPLACENCY",
    "COMMUNICATION_FAILURE",
  ],
  EQUIPMENT_SOFTWARE: [
    "EQUIPMENT_FAILURE",
    "SOFTWARE_ISSUE",
    "CALIBRATION",
    "WRONG_SETTINGS",
  ],
  MATERIALS: [
    "WRONG_MATERIAL",
    "DEFECTIVE_MATERIAL",
    "MATERIAL_UNAVAILABLE",
  ],
  MEASUREMENT_INFORMATION: [
    "WRONG_DATA",
    "MISSING_INFORMATION",
    "INCORRECT_MEASUREMENT",
    "POOR_DOCUMENTATION",
  ],
  ENVIRONMENT_WORK_CONDITIONS: [
    "WEATHER",
    "POOR_LIGHTING",
    "HIGH_TEMPERATURE",
    "CONFINED_SPACE",
    "NOISE",
  ],
  MANAGEMENT_GOVERNANCE: [
    "LACK_OF_SUPERVISION",
    "POOR_PLANNING",
    "TRAINING_DEFICIENCY",
    "RESOURCE_ALLOCATION",
    "RISK_ASSESSMENT_INADEQUATE",
    "MOC_NOT_CONDUCTED",
  ],
};

export const ROOT_CAUSE_SUBCATEGORY_LABELS: Record<RootCauseCategoryValue, Record<string, string>> = {
  PROCESS_METHODS: {
    PROCEDURE_NOT_FOLLOWED: "Procedure not followed",
    PROCEDURE_INADEQUATE: "Procedure inadequate",
    SOP_NOT_AVAILABLE: "SOP not available",
    CHECKLIST_NOT_USED: "Checklist not used",
    PROCESS_GAP: "Process Gap",
  },
  HUMAN_FACTORS: {
    HUMAN_ERROR: "Human error",
    LACK_OF_ATTENTION: "Lack of attention",
    FATIGUE: "Fatigue",
    COMPLACENCY: "Complacency",
    COMMUNICATION_FAILURE: "Communication failure",
  },
  EQUIPMENT_SOFTWARE: {
    EQUIPMENT_FAILURE: "Equipment failure",
    SOFTWARE_ISSUE: "Software issue",
    CALIBRATION: "Calibration",
    WRONG_SETTINGS: "Wrong settings",
  },
  MATERIALS: {
    WRONG_MATERIAL: "Wrong material",
    DEFECTIVE_MATERIAL: "Defective material",
    MATERIAL_UNAVAILABLE: "Material unavailable",
  },
  MEASUREMENT_INFORMATION: {
    WRONG_DATA: "Wrong data",
    MISSING_INFORMATION: "Missing information",
    INCORRECT_MEASUREMENT: "Incorrect measurement",
    POOR_DOCUMENTATION: "Poor documentation",
  },
  ENVIRONMENT_WORK_CONDITIONS: {
    WEATHER: "Weather",
    POOR_LIGHTING: "Poor lighting",
    HIGH_TEMPERATURE: "High temperature",
    CONFINED_SPACE: "Confined space",
    NOISE: "Noise",
  },
  MANAGEMENT_GOVERNANCE: {
    LACK_OF_SUPERVISION: "Lack of supervision",
    POOR_PLANNING: "Poor planning",
    TRAINING_DEFICIENCY: "Training deficiency",
    RESOURCE_ALLOCATION: "Resource allocation",
    RISK_ASSESSMENT_INADEQUATE: "Risk assessment inadequate",
    MOC_NOT_CONDUCTED: "MOC not conducted",
  },
};
