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
const optionalDate = z.preprocess(blankToUndefined, z.coerce.date().optional());

export const vesselSchema = z.object({
  name: z.string().trim().min(2, "Vessel name is required").max(200),
  // Short fleet code (e.g. "SWA") prefixed onto every ref number this
  // vessel raises (SWA-DR-2026-0001, SWA-NCR-2026-0001, ...) — uppercased
  // so "swa" and "SWA" aren't treated as different codes. Mandatory: a
  // vessel can't be saved without one, since every report type needs it.
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,6}$/, "Code is required — 2-6 letters/numbers"),
  // Optional — real-fleet vessels can be added before their IMO is on file
  // and filled in later, but if given it must be a valid 7-digit number.
  imo: z.string().trim().regex(/^\d{7}$/, "IMO number must be 7 digits").optional().or(z.literal("")),
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
  // The actual date the vessel left the fleet (only meaningful when
  // status is SOLD) — office-entered so it reflects the real sale date,
  // not whenever someone happened to update the record. Falls back to
  // today if left blank. Drives when Exposure Hours stops accruing.
  archivedAt: optionalDate,
  capacityCbm: optionalNumber,
  netTonnage: optionalNumber,
  deadweight: optionalNumber,
  tradeArea: optionalText(100),
  registeredOwner: optionalText(200),
  headOwner: optionalText(200),
  charterer: optionalText(200),
  yearWithSwan: optionalYear,
  lastDryDock: optionalDate,
  dryDockPlace: optionalText(100),
  nextDryDockDue: optionalDate,
  portOfRegistry: optionalText(100),
  lbp: optionalNumber,
  draft: optionalNumber,
  mainEngine: optionalText(200),
  serviceSpeed: optionalNumber,
  stdFoConsumptionMt: optionalNumber,
  stdDoConsumptionMt: optionalNumber,
  navigationArea: optionalText(100),
  classNotation: optionalText(200),
  ownerAddress: optionalText(300),
  builder: optionalText(200),
  keelLaidDate: optionalDate,
  launchingDate: optionalDate,
  deliveryDate: optionalDate,
  totalComplement: z.preprocess(blankToUndefined, z.coerce.number().int().positive().optional()),
  satPhone: optionalText(50),
  vesselEmail: z.preprocess(
    blankToUndefined,
    z.string().trim().email("Invalid email").max(200).optional(),
  ),
});

export type VesselInput = z.infer<typeof vesselSchema>;
