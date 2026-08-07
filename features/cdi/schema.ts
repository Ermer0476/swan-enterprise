import { z } from "zod";
import { ROOT_CAUSE_CATEGORIES } from "@/lib/root-cause";

export const INSPECTION_STATUSES = ["OPEN", "IN_PROGRESS", "CLOSED"] as const;
export const FINDING_STATUSES = ["OPEN", "CLOSED"] as const;
export const CDI_SCHEMES = ["CDI-M", "CDI-T", "CDI-SQAS"] as const;

// CDI checklist sections. 5LP is type-specific (LPG cargo operations).
export const CDI_OBSERVATION_CATEGORIES = [
  "SECTION_1",
  "SECTION_2",
  "SECTION_3",
  "SECTION_4",
  "SECTION_5LP",
  "SECTION_6",
  "SECTION_7",
  "SECTION_8",
  "SECTION_9",
  "SECTION_10",
  "SECTION_11",
  "SECTION_12",
  "SECTION_13",
  "SECTION_14",
] as const;
export const CDI_OBSERVATION_CATEGORY_LABELS: Record<(typeof CDI_OBSERVATION_CATEGORIES)[number], string> = {
  SECTION_1: "1 — Certification, Manning, etc.",
  SECTION_2: "2 — Management and Personnel",
  SECTION_3: "3 — Bridge",
  SECTION_4: "4 — Mooring",
  SECTION_5LP: "5LP — Cargo Operations (LPG)",
  SECTION_6: "6 — Engine Department",
  SECTION_7: "7 — Operational Safety",
  SECTION_8: "8 — Health, Safety and Personnel Protection",
  SECTION_9: "9 — Firefighting",
  SECTION_10: "10 — Lifesaving",
  SECTION_11: "11 — Environmental Protection",
  SECTION_12: "12 — Security",
  SECTION_13: "13 — Hull and Superstructure",
  SECTION_14: "14 — Accommodation",
};

export const createCdiSchema = z.object({
  vesselId: z.string().uuid().optional().or(z.literal("")),
  inspectorName: z.string().trim().max(200).optional().or(z.literal("")),
  scheme: z.string().trim().max(20).optional().or(z.literal("")),
  port: z.string().trim().max(200).optional().or(z.literal("")),
  inspectionDate: z
    .string()
    .min(1, "Date is required")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  summary: z.string().trim().max(10000).optional().or(z.literal("")),
});

export const addObservationSchema = z.object({
  inspectionId: z.string().uuid(),
  questionRef: z.string().trim().max(40).optional().or(z.literal("")),
  // Required — feeds the CDI KPI, so an observation can't be saved without
  // it (a missing value here would silently drop out of that reporting).
  category: z.enum(CDI_OBSERVATION_CATEGORIES, { message: "Category is required" }),
  observation: z.string().trim().min(3, "Observation is required").max(10000),
  rootCauseCategory: z.enum(ROOT_CAUSE_CATEGORIES, { message: "Root cause category is required" }),
  rootCauseSubCategory: z.string().trim().max(60).optional().or(z.literal("")),
  rootCause: z.string().trim().max(10000).optional().or(z.literal("")),
});

export const updateObservationSchema = z.object({
  observationId: z.string().uuid(),
  response: z.string().trim().max(10000).optional().or(z.literal("")),
  status: z.enum(FINDING_STATUSES),
  category: z.enum(CDI_OBSERVATION_CATEGORIES, { message: "Category is required" }),
  rootCauseCategory: z.enum(ROOT_CAUSE_CATEGORIES, { message: "Root cause category is required" }),
  rootCauseSubCategory: z.string().trim().max(60).optional().or(z.literal("")),
  rootCause: z.string().trim().max(10000).optional().or(z.literal("")),
});
