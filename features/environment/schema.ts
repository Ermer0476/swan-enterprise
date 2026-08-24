import { z } from "zod";

// Mirrors the fleet's existing "GARBAGE Form" + "OIL Immision" Excel sheet —
// one row-set per vessel per month. Category letters are this fleet's own
// convention (confirmed with the office), not standard MARPOL Annex V
// lettering.
export const GARBAGE_CATEGORIES = [
  "PLASTICS",
  "FOOD_WASTES",
  "DOMESTIC_WASTES",
  "COOKING_OIL",
  "INCINERATOR_ASHES",
  "OPERATIONAL_WASTES",
  "ANIMAL_CARCASSES",
  "FISHING_GEAR",
  "E_WASTE",
] as const;
export type GarbageCategoryValue = (typeof GARBAGE_CATEGORIES)[number];
export const GARBAGE_CATEGORY_LABELS: Record<GarbageCategoryValue, string> = {
  PLASTICS: "A — Plastics",
  FOOD_WASTES: "B — Food Wastes",
  DOMESTIC_WASTES: "C — Domestic Wastes",
  COOKING_OIL: "D — Cooking Oil",
  INCINERATOR_ASHES: "E — Incinerator Ashes",
  OPERATIONAL_WASTES: "F — Operational Wastes",
  ANIMAL_CARCASSES: "G — Animal Carcasses",
  FISHING_GEAR: "H — Fishing Gear",
  E_WASTE: "I — E-Waste",
};

/** Total Garbage per category, derived from the three logged figures — never
 * stored, same "derive at read time" convention as
 * features/vessel-tracker/schema.ts's foDoTotals. Pure function so both
 * server queries and the client-side entry form can share it. */
export function garbageTotals(entries: { category: GarbageCategoryValue; overboardToSeaCbm: number | null; incineratedCbm: number | null; dischargeAshoreCbm: number | null }[]) {
  return entries.map((e) => ({
    category: e.category,
    totalCbm: (e.overboardToSeaCbm ?? 0) + (e.incineratedCbm ?? 0) + (e.dischargeAshoreCbm ?? 0),
  }));
}

/** Total Monthly Discharged for Sewage — never stored, same "derive at read
 * time" convention as garbageTotals above. */
export function sewageTotalDischarged(r: { sewageDischargedAtSea: number | null; sewageDischargedToFacility: number | null }): number {
  return (r.sewageDischargedAtSea ?? 0) + (r.sewageDischargedToFacility ?? 0);
}

// Blank text-input cells are common (not every vessel logs every field every
// month) — treat "" the same as not provided rather than a validation error.
const optionalNumber = () =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : v), z.coerce.number().optional());
const optionalInt = () =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : v), z.coerce.number().int().optional());
const optionalText = (max = 200) => z.string().trim().max(max).optional().or(z.literal(""));

// Only Sewage and Cargo offer a Unit choice at entry time — see
// UnitMasterMetric in prisma/schema.prisma for why. Everything else below is
// always entered directly in its one fixed standard unit, exactly as simple
// as the form was before this expansion.
export const environmentRecordFields = {
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),

  // Ballast Water
  ballastWaterQuantity: optionalNumber(),
  ballastWaterOperations: optionalInt(),
  ballastWaterMethod: optionalText(),
  ballastWaterRemarks: optionalText(500),

  // Sewage — split by disposal route; Total Monthly Discharged is derived
  // (sum of the two), never submitted itself.
  sewageDischargedAtSea: optionalNumber(),
  sewageDischargedToFacility: optionalNumber(),
  sewageUnit: optionalText(20),
  sewageReceptionFacility: optionalText(),
  sewageRemarks: optionalText(500),

  // Grey Water
  greyWaterGenerated: optionalNumber(),
  greyWaterDischarged: optionalNumber(),
  greyWaterRetained: optionalNumber(),
  greyWaterRemarks: optionalText(500),

  // Refrigerant Gas
  refrigerantGasType: optionalText(100),
  refrigerantEquipment: optionalText(),
  refrigerantAdded: optionalNumber(),
  refrigerantRecovered: optionalNumber(),
  refrigerantDisposedAshore: optionalNumber(),
  refrigerantLeakage: optionalNumber(),
  refrigerantQuantityKg: optionalNumber(),
  refrigerantRemarks: optionalText(500),

  // Cargo — analytics denominator only, never a MARPOL waste quantity.
  cargoLoaded: optionalNumber(),
  cargoDischarged: optionalNumber(),
  cargoType: optionalText(100),
  cargoUnit: optionalText(20),
  cargoPort: optionalText(100),

  // Stern Tube / Lube Oil
  lubeOilType: optionalText(100),
  lubeOilAdded: optionalNumber(),
  lubeOilTransferred: optionalNumber(),
  lubeOilLost: optionalNumber(),
  lubeOilEquipment: optionalText(),
  lubeOilRemarks: optionalText(500),

  // Bilge
  bilgeGenerated: optionalNumber(),
  bilgeProcessed: optionalNumber(),
  bilgeDischargedOws: optionalNumber(),
  bilgeLandedAshore: optionalNumber(),
  bilgeRetained: optionalNumber(),
  bilgeRemarks: optionalText(500),

  // Sludge
  sludgeGenerated: optionalNumber(),
  sludgeRetained: optionalNumber(),
  sludgeTransferredIncinerator: optionalNumber(),
  sludgeLandedAshore: optionalNumber(),
  sludgeRemarks: optionalText(500),
};

// Fixed-row garbage ledger — one Overboard/Incinerated/Discharge-Ashore group
// per category, named `garbage_<CATEGORY>_<field>` so it reads straight off
// FormData, same pattern as bunkerFieldName in features/vessel-tracker/schema.ts.
export function garbageFieldName(category: GarbageCategoryValue, field: "overboard" | "incinerated" | "ashore"): string {
  return `garbage_${category}_${field}`;
}

const garbageFields = Object.fromEntries(
  GARBAGE_CATEGORIES.flatMap((category) => [
    [garbageFieldName(category, "overboard"), optionalNumber()],
    [garbageFieldName(category, "incinerated"), optionalNumber()],
    [garbageFieldName(category, "ashore"), optionalNumber()],
  ]),
);

export const addEnvironmentRecordSchema = z.object({
  vesselId: z.string().uuid(),
  ...environmentRecordFields,
  ...garbageFields,
});

export const updateEnvironmentRecordSchema = z.object({
  recordId: z.string().uuid(),
  ...environmentRecordFields,
  ...garbageFields,
});

export const deleteEnvironmentRecordSchema = z.object({
  recordId: z.string().uuid(),
});

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Unit Master — controlled conversion factors backing the Sewage/Cargo Unit
// pickers on the Environmental Records entry form. See UnitMasterMetric in
// prisma/schema.prisma for why only these two categories offer a choice.
export const UNIT_MASTER_METRICS = ["SEWAGE", "CARGO"] as const;
export type UnitMasterMetricValue = (typeof UNIT_MASTER_METRICS)[number];
export const UNIT_MASTER_METRIC_LABELS: Record<UnitMasterMetricValue, string> = {
  SEWAGE: "Sewage",
  CARGO: "Cargo",
};

export const addUnitMasterSchema = z.object({
  metric: z.enum(UNIT_MASTER_METRICS),
  unit: z.string().trim().min(1).max(20),
  unitLabel: z.string().trim().min(1).max(100),
  standardUnit: z.string().trim().min(1).max(20),
  toStandardFactor: z.coerce.number().positive(),
  isDefault: z.coerce.boolean().optional().default(false),
});

export const updateUnitMasterSchema = z.object({
  id: z.string().uuid(),
  unitLabel: z.string().trim().min(1).max(100),
  toStandardFactor: z.coerce.number().positive(),
  isDefault: z.coerce.boolean().optional().default(false),
});

export const deleteUnitMasterSchema = z.object({
  id: z.string().uuid(),
});
