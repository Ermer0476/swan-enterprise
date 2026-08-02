import { z } from "zod";

export const CIRCULAR_SOURCES = ["FLAG", "CLASS", "INSURANCE", "COMPANY"] as const;
export type CircularSourceValue = (typeof CIRCULAR_SOURCES)[number];

export const CIRCULAR_SOURCE_LABELS: Record<CircularSourceValue, string> = {
  FLAG: "Flag State",
  CLASS: "Classification Society",
  INSURANCE: "Insurance / P&I Club",
  COMPANY: "Company",
};

export const CIRCULAR_CATEGORIES = [
  "SAFETY",
  "TECHNICAL",
  "NAVIGATIONAL",
  "SECURITY",
  "ENVIRONMENTAL",
  "SAFETY_CAMPAIGN",
  "HEALTH_HYGIENE",
  "OPERATIONAL",
  "HR",
  "REGULATORY",
  "OTHER",
] as const;

// Suggested values per source — free text underneath (see `issuingBody` on
// the schema), so these are convenience options, not a locked list. The
// fleet's flag/class roster grows over time; typing a value not listed here
// is always allowed (and is exactly what the on-page "Other" tab surfaces —
// see app/(app)/circulars/page.tsx).
export const ISSUING_BODY_SUGGESTIONS: Record<CircularSourceValue, string[]> = {
  FLAG: ["Panama", "Singapore", "Malaysia", "Marshall Islands", "Malta"],
  CLASS: ["Bureau Veritas (BV)", "Nippon Kaiji Kyokai (ClassNK)", "DNV", "ABS", "Lloyd's Register"],
  INSURANCE: ["Gard", "West of England", "Britannia", "NorthStandard"],
  COMPANY: [],
};

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const createCircularSchema = z.object({
  title: z.string().trim().min(3, "Title is required").max(200),
  vesselId: z.string().uuid().optional().or(z.literal("")),
  source: z.enum(CIRCULAR_SOURCES),
  issuingBody: optionalText(120),
  category: z.enum(CIRCULAR_CATEGORIES),
  issueDate: z
    .string()
    .min(1, "Date is required")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  dateReceived: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Invalid date"),
  body: z.string().trim().min(10, "Circular content is required").max(10000),
  // Office users to track individually for acknowledgement (e.g. the
  // Superintendent) — on top of whichever vessel(s) the circular targets,
  // which are always tracked automatically. See createCircularAction.
  notifyUserIds: z.array(z.string()).default([]),
});
