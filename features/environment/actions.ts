"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import {
  addEnvironmentRecordSchema,
  updateEnvironmentRecordSchema,
  deleteEnvironmentRecordSchema,
  addUnitMasterSchema,
  updateUnitMasterSchema,
  deleteUnitMasterSchema,
  GARBAGE_CATEGORIES,
  garbageFieldName,
  MONTH_NAMES,
  type GarbageCategoryValue,
} from "./schema";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

async function guardVesselAccess(companyId: string, vesselId: string, userVesselId: string | null, isShipboard: boolean) {
  if (isShipboard && userVesselId !== vesselId) {
    return { vessel: null, error: "You can only log environment data for your own vessel" };
  }
  const vessel = await prisma.vessel.findFirst({ where: { id: vesselId, companyId, deletedAt: null } });
  if (!vessel) return { vessel: null, error: "Vessel not found" };
  if (vessel.archivedAt) return { vessel: null, error: "This vessel is archived — its environment records are read-only" };
  return { vessel, error: null };
}

type ParsedEnvironmentRecord = ReturnType<typeof addEnvironmentRecordSchema.parse> | ReturnType<typeof updateEnvironmentRecordSchema.parse>;

/** Looks up the controlled factor for one (metric, unit) pair and returns
 * the normalized quantity + the standard unit it's normalized into — never
 * a factor the caller can override. Returns nulls when no quantity or no
 * unit was submitted, or when the chosen unit isn't in the Unit Master
 * (treated the same as "not normalizable yet" rather than a hard error, so
 * a still-unconfigured unit doesn't block saving the raw entry). */
async function normalize(
  companyId: string,
  metric: "SEWAGE" | "CARGO",
  quantity: number | undefined,
  unit: string | undefined,
): Promise<{ normalized: number | null; standardUnit: string | null }> {
  if (quantity == null || !unit) return { normalized: null, standardUnit: null };
  const row = await prisma.unitMaster.findUnique({
    where: { companyId_metric_unit: { companyId, metric, unit } },
  });
  if (!row) return { normalized: null, standardUnit: null };
  return { normalized: quantity * row.toStandardFactor, standardUnit: row.standardUnit };
}

async function toDataFields(companyId: string, d: ParsedEnvironmentRecord) {
  // Normalize the TOTAL (at sea + to facility) — that combined figure is
  // what MARPOL/KPI reporting actually cares about; the two routes stay
  // separately stored for the breakdown, same "detail lines + a derived
  // total" shape as the Garbage ledger.
  const sewageTotal =
    d.sewageDischargedAtSea != null || d.sewageDischargedToFacility != null
      ? (d.sewageDischargedAtSea ?? 0) + (d.sewageDischargedToFacility ?? 0)
      : undefined;
  const sewage = await normalize(companyId, "SEWAGE", sewageTotal, d.sewageUnit || undefined);
  const cargoLoaded = await normalize(companyId, "CARGO", d.cargoLoaded, d.cargoUnit || undefined);
  const cargoDischarged = await normalize(companyId, "CARGO", d.cargoDischarged, d.cargoUnit || undefined);

  return {
    year: d.year,
    month: d.month,

    ballastWaterQuantity: d.ballastWaterQuantity ?? null,
    ballastWaterOperations: d.ballastWaterOperations ?? null,
    ballastWaterMethod: d.ballastWaterMethod || null,
    ballastWaterRemarks: d.ballastWaterRemarks || null,

    sewageDischargedAtSea: d.sewageDischargedAtSea ?? null,
    sewageDischargedToFacility: d.sewageDischargedToFacility ?? null,
    sewageUnit: d.sewageUnit || null,
    sewageQuantityNormalized: sewage.normalized,
    sewageQuantityStandardUnit: sewage.standardUnit,
    sewageReceptionFacility: d.sewageReceptionFacility || null,
    sewageRemarks: d.sewageRemarks || null,

    greyWaterGenerated: d.greyWaterGenerated ?? null,
    greyWaterDischarged: d.greyWaterDischarged ?? null,
    greyWaterRetained: d.greyWaterRetained ?? null,
    greyWaterRemarks: d.greyWaterRemarks || null,

    refrigerantGasType: d.refrigerantGasType || null,
    refrigerantEquipment: d.refrigerantEquipment || null,
    refrigerantAdded: d.refrigerantAdded ?? null,
    refrigerantRecovered: d.refrigerantRecovered ?? null,
    refrigerantDisposedAshore: d.refrigerantDisposedAshore ?? null,
    refrigerantLeakage: d.refrigerantLeakage ?? null,
    refrigerantQuantityKg: d.refrigerantQuantityKg ?? null,
    refrigerantRemarks: d.refrigerantRemarks || null,

    cargoLoaded: d.cargoLoaded ?? null,
    cargoDischarged: d.cargoDischarged ?? null,
    cargoType: d.cargoType || null,
    cargoUnit: d.cargoUnit || null,
    cargoLoadedNormalized: cargoLoaded.normalized,
    cargoDischargedNormalized: cargoDischarged.normalized,
    cargoStandardUnit: cargoLoaded.standardUnit ?? cargoDischarged.standardUnit,
    cargoPort: d.cargoPort || null,

    lubeOilType: d.lubeOilType || null,
    lubeOilAdded: d.lubeOilAdded ?? null,
    lubeOilTransferred: d.lubeOilTransferred ?? null,
    lubeOilLost: d.lubeOilLost ?? null,
    lubeOilEquipment: d.lubeOilEquipment || null,
    lubeOilRemarks: d.lubeOilRemarks || null,

    bilgeGenerated: d.bilgeGenerated ?? null,
    bilgeProcessed: d.bilgeProcessed ?? null,
    bilgeDischargedOws: d.bilgeDischargedOws ?? null,
    bilgeLandedAshore: d.bilgeLandedAshore ?? null,
    bilgeRetained: d.bilgeRetained ?? null,
    bilgeRemarks: d.bilgeRemarks || null,

    sludgeGenerated: d.sludgeGenerated ?? null,
    sludgeRetained: d.sludgeRetained ?? null,
    sludgeTransferredIncinerator: d.sludgeTransferredIncinerator ?? null,
    sludgeLandedAshore: d.sludgeLandedAshore ?? null,
    sludgeRemarks: d.sludgeRemarks || null,
  };
}

type GarbageRow = { companyId: string; category: GarbageCategoryValue; overboardToSeaCbm: number | null; incineratedCbm: number | null; dischargeAshoreCbm: number | null };

/** Only categories the vessel actually logged something for get a row — same
 * "skip untouched grades" convention as buildBunkerRows in
 * features/vessel-tracker/actions.ts. No derived/validated field here (unlike
 * bunker's consumed) since Overboard/Incinerated/Discharge Ashore are each
 * independently submitted; Total Garbage is only ever computed at read time. */
function buildGarbageRows(d: Record<string, unknown>, companyId: string): GarbageRow[] {
  const num = (key: string): number | null => {
    const v = d[key];
    return typeof v === "number" ? v : null;
  };
  const rows: GarbageRow[] = [];
  for (const category of GARBAGE_CATEGORIES) {
    const overboardToSeaCbm = num(garbageFieldName(category, "overboard"));
    const incineratedCbm = num(garbageFieldName(category, "incinerated"));
    const dischargeAshoreCbm = num(garbageFieldName(category, "ashore"));
    if (overboardToSeaCbm === null && incineratedCbm === null && dischargeAshoreCbm === null) continue;
    rows.push({ companyId, category, overboardToSeaCbm, incineratedCbm, dischargeAshoreCbm });
  }
  return rows;
}

function periodLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

export async function addEnvironmentRecordAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("environment:create");
  const parsed = addEnvironmentRecordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const { vessel, error } = await guardVesselAccess(user.companyId, d.vesselId, user.vesselId, user.department === "SHIPBOARD");
  if (!vessel) return fail(error ?? "Vessel not found");

  const existing = await prisma.environmentRecord.findFirst({
    where: { companyId: user.companyId, vesselId: d.vesselId, year: d.year, month: d.month, deletedAt: null },
  });
  if (existing) return fail(`An environment record for ${periodLabel(d.year, d.month)} already exists for ${vessel.name}.`);

  const garbageRows = buildGarbageRows(d, user.companyId);
  const dataFields = await toDataFields(user.companyId, d);
  const record = await prisma.environmentRecord.create({
    data: {
      companyId: user.companyId,
      vesselId: d.vesselId,
      createdBy: user.id,
      updatedBy: user.id,
      ...dataFields,
      garbageEntries: { create: garbageRows },
    },
  });

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "EnvironmentRecord",
    entityId: record.id,
    summary: `Logged environment record for ${vessel.name} — ${periodLabel(d.year, d.month)}`,
  });

  revalidatePath(`/environment/${d.vesselId}`);
  revalidatePath("/environment");
  return OK;
}

export async function updateEnvironmentRecordAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("environment:update");
  const parsed = updateEnvironmentRecordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const existing = await prisma.environmentRecord.findFirst({ where: { id: d.recordId, companyId: user.companyId, deletedAt: null } });
  if (!existing) return fail("Environment record not found");

  const { vessel, error } = await guardVesselAccess(user.companyId, existing.vesselId, user.vesselId, user.department === "SHIPBOARD");
  if (!vessel) return fail(error ?? "Vessel not found");

  const duplicate = await prisma.environmentRecord.findFirst({
    where: { companyId: user.companyId, vesselId: existing.vesselId, year: d.year, month: d.month, deletedAt: null, NOT: { id: d.recordId } },
  });
  if (duplicate) return fail(`An environment record for ${periodLabel(d.year, d.month)} already exists for ${vessel.name}.`);

  const garbageRows = buildGarbageRows(d, user.companyId);
  const dataFields = await toDataFields(user.companyId, d);
  await prisma.$transaction([
    prisma.garbageLedgerEntry.deleteMany({ where: { environmentRecordId: d.recordId } }),
    prisma.environmentRecord.update({
      where: { id: d.recordId },
      data: {
        updatedBy: user.id,
        ...dataFields,
        garbageEntries: { create: garbageRows },
      },
    }),
  ]);

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "EnvironmentRecord",
    entityId: d.recordId,
    summary: `Updated environment record for ${vessel.name} — ${periodLabel(d.year, d.month)}`,
  });

  revalidatePath(`/environment/${existing.vesselId}`);
  revalidatePath("/environment");
  return OK;
}

export async function deleteEnvironmentRecordAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("environment:delete");
  const parsed = deleteEnvironmentRecordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Invalid request");

  const existing = await prisma.environmentRecord.findFirst({ where: { id: parsed.data.recordId, companyId: user.companyId, deletedAt: null } });
  if (!existing) return fail("Environment record not found");

  await prisma.environmentRecord.update({
    where: { id: existing.id },
    data: { deletedAt: new Date(), deletedBy: user.id },
  });

  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "EnvironmentRecord",
    entityId: existing.id,
    summary: `Deleted environment record — ${periodLabel(existing.year, existing.month)}`,
  });

  revalidatePath(`/environment/${existing.vesselId}`);
  revalidatePath("/environment");
  return OK;
}

// --- Unit Master — controlled conversion factors (admin-only) ---
// Deliberately NOT reachable from the monthly entry form; only from the
// dedicated Unit Master admin page. This is the one place
// toStandardFactor/standardUnit are ever written.

export async function addUnitMasterAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("environment:manage-units");
  const parsed = addUnitMasterSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const existing = await prisma.unitMaster.findUnique({
    where: { companyId_metric_unit: { companyId: user.companyId, metric: d.metric, unit: d.unit } },
  });
  if (existing) return fail(`"${d.unit}" is already defined for this metric.`);

  if (d.isDefault) {
    await prisma.unitMaster.updateMany({ where: { companyId: user.companyId, metric: d.metric }, data: { isDefault: false } });
  }

  const row = await prisma.unitMaster.create({
    data: { companyId: user.companyId, createdBy: user.id, updatedBy: user.id, ...d },
  });

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "UnitMaster",
    entityId: row.id,
    summary: `Added unit "${d.unitLabel}" for ${d.metric} (× ${d.toStandardFactor} → ${d.standardUnit})`,
  });

  revalidatePath("/settings/environment-units");
  return OK;
}

export async function updateUnitMasterAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("environment:manage-units");
  const parsed = updateUnitMasterSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const existing = await prisma.unitMaster.findFirst({ where: { id: d.id, companyId: user.companyId } });
  if (!existing) return fail("Unit not found");

  if (d.isDefault && !existing.isDefault) {
    await prisma.unitMaster.updateMany({ where: { companyId: user.companyId, metric: existing.metric }, data: { isDefault: false } });
  }

  await prisma.unitMaster.update({
    where: { id: d.id },
    data: { unitLabel: d.unitLabel, toStandardFactor: d.toStandardFactor, isDefault: d.isDefault, updatedBy: user.id },
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "UnitMaster",
    entityId: d.id,
    summary: `Updated unit "${existing.unit}" for ${existing.metric} (× ${d.toStandardFactor} → ${existing.standardUnit})`,
  });

  revalidatePath("/settings/environment-units");
  return OK;
}

export async function deleteUnitMasterAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("environment:manage-units");
  const parsed = deleteUnitMasterSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Invalid request");

  const existing = await prisma.unitMaster.findFirst({ where: { id: parsed.data.id, companyId: user.companyId } });
  if (!existing) return fail("Unit not found");

  await prisma.unitMaster.delete({ where: { id: existing.id } });

  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "UnitMaster",
    entityId: existing.id,
    summary: `Deleted unit "${existing.unit}" for ${existing.metric}`,
  });

  revalidatePath("/settings/environment-units");
  return OK;
}
