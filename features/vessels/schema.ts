import { z } from "zod";

export const VESSEL_STATUSES = ["ACTIVE", "LAID_UP", "DRYDOCK", "SOLD"] as const;

/** Turn an ENUM_VALUE into a "Enum Value" label. */
export function humanize(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

/** Blank string form field -> undefined, so it stays unset rather than 0/NaN. */
const blankToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const optionalNumber = z.preprocess(blankToUndefined, z.coerce.number().positive().optional());
const optionalYear = z.preprocess(
  blankToUndefined,
  z.coerce.number().int().min(1900).max(2100).optional(),
);

export const vesselSchema = z.object({
  name: z.string().trim().min(2, "Vessel name is required").max(200),
  // Short fleet code (e.g. "SWA") prefixed onto this vessel's NCR numbers —
  // uppercased so "swa" and "SWA" aren't treated as different codes.
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,6}$/, "Code must be 2-6 letters/numbers"),
  imo: z.string().trim().regex(/^\d{7}$/, "IMO number must be 7 digits"),
  officialNumber: optionalText(50),
  callSign: optionalText(20),
  mmsi: z.string().trim().regex(/^\d{9}$/, "MMSI must be 9 digits").optional().or(z.literal("")),
  flag: optionalText(100),
  type: z.string().trim().min(1, "Type of ship is required").max(100),
  classificationSociety: optionalText(100),
  yearBuilt: optionalYear,
  grossTonnage: optionalNumber,
  loa: optionalNumber,
  breadth: optionalNumber,
  depth: optionalNumber,
  status: z.enum(VESSEL_STATUSES),
});

export type VesselInput = z.infer<typeof vesselSchema>;
