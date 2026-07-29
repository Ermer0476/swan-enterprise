import { z } from "zod";
import {
  ROOT_CAUSE_CATEGORIES,
  ROOT_CAUSE_LABELS,
  HUMAN_FACTORS,
  HUMAN_FACTOR_LABELS,
  MAX_CONTRIBUTING_FACTORS,
} from "@/lib/root-cause";

// Re-exported for backward compatibility — other modules should prefer
// importing these directly from "@/lib/root-cause".
export {
  ROOT_CAUSE_CATEGORIES,
  ROOT_CAUSE_LABELS,
  HUMAN_FACTORS,
  HUMAN_FACTOR_LABELS,
  MAX_CONTRIBUTING_FACTORS,
};

export const INCIDENT_TYPES = [
  "PERSONAL_INJURY",
  "OCCUPATIONAL_ILLNESS",
  "ENVIRONMENTAL",
  "PROPERTY_EQUIPMENT_DAMAGE",
  "LOSS_OF_CONTAINMENT",
  "FIRE_EXPLOSION",
  "NAVIGATION_MARINE",
  "CARGO_OPERATION",
  "MOORING_OPERATION",
  "SECURITY",
  "CYBER_SECURITY",
  "REGULATORY_COMPLIANCE",
  "OPERATIONAL",
] as const;

export type IncidentTypeValue = (typeof INCIDENT_TYPES)[number];

export const INCIDENT_TYPE_LABELS: Record<IncidentTypeValue, string> = {
  PERSONAL_INJURY: "Personal Injury",
  OCCUPATIONAL_ILLNESS: "Occupational Illness",
  ENVIRONMENTAL: "Environmental Incident",
  PROPERTY_EQUIPMENT_DAMAGE: "Property / Equipment Damage",
  LOSS_OF_CONTAINMENT: "Loss of Containment",
  FIRE_EXPLOSION: "Fire / Explosion",
  NAVIGATION_MARINE: "Navigation / Marine Incident",
  CARGO_OPERATION: "Cargo Operation",
  MOORING_OPERATION: "Mooring Operation",
  SECURITY: "Security Incident",
  CYBER_SECURITY: "Cyber Security Incident",
  REGULATORY_COMPLIANCE: "Regulatory / Compliance",
  OPERATIONAL: "Operational Incident",
};

// Each Type of incident has its own sub-category list (shown as a dropdown
// once its checkbox is checked in the report form).
export const INCIDENT_SUBCATEGORIES: Record<IncidentTypeValue, readonly string[]> = {
  PERSONAL_INJURY: ["FAC", "MTC", "RWC", "LTI", "FATALITY"],
  OCCUPATIONAL_ILLNESS: [
    "HEAT_STRESS",
    "CHEMICAL_EXPOSURE",
    "HEARING_LOSS",
    "RESPIRATORY_ILLNESS",
    "SKIN_DISEASE",
    "OTHER_OCCUPATIONAL_ILLNESS",
  ],
  ENVIRONMENTAL: [
    "OIL_SPILL",
    "CARGO_SPILL",
    "CHEMICAL_SPILL",
    "SEWAGE_DISCHARGE",
    "GARBAGE_POLLUTION",
    "AIR_EMISSION",
    "BALLAST_WATER_NON_COMPLIANCE",
    "MARPOL_VIOLATION",
  ],
  PROPERTY_EQUIPMENT_DAMAGE: [
    "MACHINERY_DAMAGE",
    "ELECTRICAL_DAMAGE",
    "STRUCTURAL_DAMAGE",
    "CARGO_EQUIPMENT_DAMAGE",
    "NAVIGATION_EQUIPMENT_DAMAGE",
    "LIFTING_EQUIPMENT_DAMAGE",
    "THIRD_PARTY_PROPERTY_DAMAGE",
  ],
  LOSS_OF_CONTAINMENT: [
    "CARGO_LEAK",
    "FUEL_OIL_LEAK",
    "LUBRICATING_OIL_LEAK",
    "HYDRAULIC_OIL_LEAK",
    "CHEMICAL_LEAK",
    "GAS_LEAK",
  ],
  FIRE_EXPLOSION: ["FIRE", "EXPLOSION", "SMOKE_EVENT", "HOT_SURFACE_IGNITION"],
  NAVIGATION_MARINE: [
    "COLLISION",
    "ALLISION",
    "CONTACT",
    "GROUNDING",
    "HEAVY_WEATHER_DAMAGE",
    "LOSS_OF_PROPULSION",
    "LOSS_OF_STEERING",
  ],
  CARGO_OPERATION: [
    "WRONG_LINE_UP",
    "CARGO_CONTAMINATION",
    "CARGO_OVERFLOW",
    "CARGO_TRANSFER_ERROR",
    "LOADING_DISCHARGING_DELAY",
  ],
  MOORING_OPERATION: [
    "LINE_PARTING",
    "SNAP_BACK_INCIDENT",
    "WINCH_FAILURE",
    "BERTH_DAMAGE",
    "FENDER_DAMAGE",
  ],
  SECURITY: ["UNAUTHORIZED_ACCESS", "THEFT", "STOWAWAY", "PIRACY_ARMED_ROBBERY", "BOMB_THREAT"],
  CYBER_SECURITY: ["MALWARE", "PHISHING", "UNAUTHORIZED_ACCESS", "DATA_LOSS", "SYSTEM_FAILURE"],
  REGULATORY_COMPLIANCE: [
    "PSC_DEFICIENCY",
    "PSC_DETENTION",
    "CLASS_DEFICIENCY",
    "FLAG_STATE_DEFICIENCY",
    "VETTING_OBSERVATION",
    "STATUTORY_NON_COMPLIANCE",
  ],
  OPERATIONAL: [
    "MAIN_ENGINE_FAILURE",
    "BLACKOUT",
    "STEERING_FAILURE",
    "CARGO_COMPRESSOR_FAILURE",
    "CRITICAL_EQUIPMENT_FAILURE",
    "VOYAGE_DELAY",
    "PORT_DELAY",
  ],
};

export const INCIDENT_SUBCATEGORY_LABELS: Record<IncidentTypeValue, Record<string, string>> = {
  PERSONAL_INJURY: {
    FAC: "First Aid Case (FAC)",
    MTC: "Medical Treatment Case (MTC)",
    RWC: "Restricted Work Case (RWC)",
    LTI: "Lost Time Injury (LTI)",
    FATALITY: "Fatality",
  },
  OCCUPATIONAL_ILLNESS: {
    HEAT_STRESS: "Heat Stress",
    CHEMICAL_EXPOSURE: "Chemical Exposure",
    HEARING_LOSS: "Hearing Loss",
    RESPIRATORY_ILLNESS: "Respiratory Illness",
    SKIN_DISEASE: "Skin Disease",
    OTHER_OCCUPATIONAL_ILLNESS: "Other Occupational Illness",
  },
  ENVIRONMENTAL: {
    OIL_SPILL: "Oil Spill",
    CARGO_SPILL: "Cargo Spill",
    CHEMICAL_SPILL: "Chemical Spill",
    SEWAGE_DISCHARGE: "Sewage Discharge",
    GARBAGE_POLLUTION: "Garbage Pollution",
    AIR_EMISSION: "Air Emission",
    BALLAST_WATER_NON_COMPLIANCE: "Ballast Water Non-Compliance",
    MARPOL_VIOLATION: "MARPOL Violation",
  },
  PROPERTY_EQUIPMENT_DAMAGE: {
    MACHINERY_DAMAGE: "Machinery Damage",
    ELECTRICAL_DAMAGE: "Electrical Damage",
    STRUCTURAL_DAMAGE: "Structural Damage",
    CARGO_EQUIPMENT_DAMAGE: "Cargo Equipment Damage",
    NAVIGATION_EQUIPMENT_DAMAGE: "Navigation Equipment Damage",
    LIFTING_EQUIPMENT_DAMAGE: "Lifting Equipment Damage",
    THIRD_PARTY_PROPERTY_DAMAGE: "Third-party Property Damage",
  },
  LOSS_OF_CONTAINMENT: {
    CARGO_LEAK: "Cargo Leak",
    FUEL_OIL_LEAK: "Fuel Oil Leak",
    LUBRICATING_OIL_LEAK: "Lubricating Oil Leak",
    HYDRAULIC_OIL_LEAK: "Hydraulic Oil Leak",
    CHEMICAL_LEAK: "Chemical Leak",
    GAS_LEAK: "Gas Leak",
  },
  FIRE_EXPLOSION: {
    FIRE: "Fire",
    EXPLOSION: "Explosion",
    SMOKE_EVENT: "Smoke Event",
    HOT_SURFACE_IGNITION: "Hot Surface Ignition",
  },
  NAVIGATION_MARINE: {
    COLLISION: "Collision",
    ALLISION: "Allision",
    CONTACT: "Contact",
    GROUNDING: "Grounding",
    HEAVY_WEATHER_DAMAGE: "Heavy Weather Damage",
    LOSS_OF_PROPULSION: "Loss of Propulsion",
    LOSS_OF_STEERING: "Loss of Steering",
  },
  CARGO_OPERATION: {
    WRONG_LINE_UP: "Wrong Line-up",
    CARGO_CONTAMINATION: "Cargo Contamination",
    CARGO_OVERFLOW: "Cargo Overflow",
    CARGO_TRANSFER_ERROR: "Cargo Transfer Error",
    LOADING_DISCHARGING_DELAY: "Loading / Discharging Delay",
  },
  MOORING_OPERATION: {
    LINE_PARTING: "Line Parting",
    SNAP_BACK_INCIDENT: "Snap-back Incident",
    WINCH_FAILURE: "Winch Failure",
    BERTH_DAMAGE: "Berth Damage",
    FENDER_DAMAGE: "Fender Damage",
  },
  SECURITY: {
    UNAUTHORIZED_ACCESS: "Unauthorized Access",
    THEFT: "Theft",
    STOWAWAY: "Stowaway",
    PIRACY_ARMED_ROBBERY: "Piracy / Armed Robbery",
    BOMB_THREAT: "Bomb Threat",
  },
  CYBER_SECURITY: {
    MALWARE: "Malware",
    PHISHING: "Phishing",
    UNAUTHORIZED_ACCESS: "Unauthorized Access",
    DATA_LOSS: "Data Loss",
    SYSTEM_FAILURE: "System Failure",
  },
  REGULATORY_COMPLIANCE: {
    PSC_DEFICIENCY: "PSC Deficiency",
    PSC_DETENTION: "PSC Detention",
    CLASS_DEFICIENCY: "Class Deficiency",
    FLAG_STATE_DEFICIENCY: "Flag State Deficiency",
    VETTING_OBSERVATION: "Vetting Observation",
    STATUTORY_NON_COMPLIANCE: "Statutory Non-Compliance",
  },
  OPERATIONAL: {
    MAIN_ENGINE_FAILURE: "Main Engine Failure",
    BLACKOUT: "Blackout",
    STEERING_FAILURE: "Steering Failure",
    CARGO_COMPRESSOR_FAILURE: "Cargo Compressor Failure",
    CRITICAL_EQUIPMENT_FAILURE: "Critical Equipment Failure",
    VOYAGE_DELAY: "Voyage Delay",
    PORT_DELAY: "Port Delay",
  },
};

export const INCIDENT_SEVERITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export const INCIDENT_STATUSES = [
  "REPORTED",
  "UNDER_INVESTIGATION",
  "ACTION_PENDING",
  "CLOSED",
] as const;

/** Turn an ENUM_VALUE into a "Enum Value" label (used for severity/status). */
export function humanize(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export const createIncidentSchema = z.object({
  title: z.string().trim().min(3, "Title is required").max(200),
  types: z
    .array(z.enum(INCIDENT_TYPES))
    .min(1, "Select at least one type of incident"),
  vesselId: z.string().uuid().optional().or(z.literal("")),
  occurredAt: z
    .string()
    .min(1, "Date is required")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  location: z.string().trim().max(200).optional().or(z.literal("")),
  description: z.string().trim().min(10, "Describe what happened").max(10000),

  // Statement of Facts — chronological Time/Event rows, paired by index.
  // Blank rows (no time AND no event) are dropped, not validated.
  sofTime: z.array(z.string()).default([]),
  sofEvent: z.array(z.string()).default([]),

  immediateAction: z.string().trim().max(10000).optional().or(z.literal("")),
  // No consequence flags, severity, or root cause here — the initial report
  // is facts + type/sub-category classification only. Severity and root
  // cause are assessed later by the office, during investigation (see
  // `investigationSchema` below); the sub-category per selected type is
  // parsed directly from `sub_<TYPE>` form fields in the create action
  // (each Type has its own sub-category list, so it can't be modeled as a
  // single static Zod field).
});

export const investigationSchema = z
  .object({
    incidentId: z.string().uuid(),
    investigationDetails: z.string().trim().min(10, "Describe what happened, based on the investigation"),
    severity: z.enum(INCIDENT_SEVERITIES),
    rootCauseCategory: z.enum(ROOT_CAUSE_CATEGORIES),
    rootCause: z.string().trim().max(10000).optional().or(z.literal("")),
    humanFactorPrimary: z.enum(HUMAN_FACTORS).optional(),
    humanFactorContributing: z
      .array(z.enum(HUMAN_FACTORS))
      .max(MAX_CONTRIBUTING_FACTORS, "Choose at most two contributing factors"),
  })
  .superRefine((v, ctx) => {
    if (v.rootCauseCategory === "HUMAN_FACTORS" && !v.humanFactorPrimary) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select the primary human factor",
        path: ["humanFactorPrimary"],
      });
    }
  });

export type SofRow = { time: string; event: string };

/** Zips sofTime/sofEvent form arrays (paired by index); drops blank rows. */
export function buildSofRows(sofTime: string[], sofEvent: string[]): SofRow[] {
  const rows: SofRow[] = [];
  const len = Math.max(sofTime.length, sofEvent.length);
  for (let i = 0; i < len; i++) {
    const time = (sofTime[i] ?? "").trim();
    const event = (sofEvent[i] ?? "").trim();
    if (time || event) rows.push({ time, event });
  }
  return rows;
}
