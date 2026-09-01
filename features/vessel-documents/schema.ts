import { z } from "zod";

// Fixed taxonomy for Vessel Documentation, per the ship's own trading
// certificate register (SHIP INFORMATION / Flag / Insurance / PSC / Misc /
// Statutory / Safety Equipment / Hull sections). Company Documents has no
// fixed list yet — its filter is built from whatever types are actually in use.
export const VESSEL_DOCUMENT_TYPES = [
  "Ship Information",
  "Flag Certificates",
  "Insurance Certificates",
  "PSC / Third Party Inspections",
  "Miscellaneous Certificates",
  "Statutory Certificates",
  "Safety Equipment",
  "Firefighting Equipment",
  "Cargo Equipment",
  "Hull Certificates",
] as const;

const optionalDate = z
  .string()
  .optional()
  .or(z.literal(""))
  .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Invalid date");

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const createVesselDocumentSchema = z.object({
  // Empty string = Company Documents (Origin: COMPANY); a real id = Vessel
  // Documentation (Origin: VESSEL) — mirrors the nullable vesselId below it.
  vesselId: z.string().uuid().optional().or(z.literal("")),
  type: z.string().trim().min(1, "Document type is required").max(80),
  refNo: optionalText(30),
  name: z.string().trim().min(2, "Document name is required").max(200),
  issuingBody: optionalText(150),
  certNo: optionalText(80),
  interval: optionalText(30),
  issuedDate: optionalDate,
  expiredDate: optionalDate,
  remarks: optionalText(1000),
});

export const updateVesselDocumentSchema = createVesselDocumentSchema.extend({
  id: z.string().uuid(),
});

export const cloneVesselDocumentsSchema = z.object({
  sourceVesselId: z.string().uuid(),
  targetVesselId: z.string().uuid().optional().or(z.literal("")),
});
