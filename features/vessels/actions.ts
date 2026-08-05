"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { vesselSchema } from "./schema";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

function parseVesselForm(formData: FormData) {
  return vesselSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    imo: formData.get("imo"),
    officialNumber: formData.get("officialNumber"),
    callSign: formData.get("callSign"),
    mmsi: formData.get("mmsi"),
    flag: formData.get("flag"),
    type: formData.get("type"),
    classificationSociety: formData.get("classificationSociety"),
    yearBuilt: formData.get("yearBuilt"),
    grossTonnage: formData.get("grossTonnage"),
    loa: formData.get("loa"),
    breadth: formData.get("breadth"),
    depth: formData.get("depth"),
    status: formData.get("status"),
    capacityCbm: formData.get("capacityCbm"),
    netTonnage: formData.get("netTonnage"),
    deadweight: formData.get("deadweight"),
    tradeArea: formData.get("tradeArea"),
    registeredOwner: formData.get("registeredOwner"),
    headOwner: formData.get("headOwner"),
    charterer: formData.get("charterer"),
    yearWithSwan: formData.get("yearWithSwan"),
    lastDryDock: formData.get("lastDryDock"),
    dryDockPlace: formData.get("dryDockPlace"),
    nextDryDockDue: formData.get("nextDryDockDue"),
  });
}

export async function createVesselAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("vessel:create");
  const parsed = parseVesselForm(formData);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const d = parsed.data;

  const existing = d.imo ? await prisma.vessel.findUnique({ where: { imo: d.imo } }) : null;
  if (existing) return fail("A vessel with this IMO number already exists");

  const codeClash = d.code
    ? await prisma.vessel.findFirst({ where: { companyId: user.companyId, code: d.code } })
    : null;
  if (codeClash) return fail(`Vessel code "${d.code}" is already in use`);

  const vessel = await prisma.vessel.create({
    data: {
      companyId: user.companyId,
      name: d.name,
      code: d.code || null,
      imo: d.imo || null,
      officialNumber: d.officialNumber || null,
      callSign: d.callSign || null,
      mmsi: d.mmsi || null,
      flag: d.flag || null,
      type: d.type,
      classificationSociety: d.classificationSociety || null,
      yearBuilt: d.yearBuilt ?? null,
      grossTonnage: d.grossTonnage ?? null,
      loa: d.loa ?? null,
      breadth: d.breadth ?? null,
      depth: d.depth ?? null,
      status: d.status,
      capacityCbm: d.capacityCbm ?? null,
      netTonnage: d.netTonnage ?? null,
      deadweight: d.deadweight ?? null,
      tradeArea: d.tradeArea || null,
      registeredOwner: d.registeredOwner || null,
      headOwner: d.headOwner || null,
      charterer: d.charterer || null,
      yearWithSwan: d.yearWithSwan ?? null,
      lastDryDock: d.lastDryDock ?? null,
      dryDockPlace: d.dryDockPlace || null,
      nextDryDockDue: d.nextDryDockDue ?? null,
      archivedAt: d.status === "SOLD" ? new Date() : null,
      createdBy: user.id,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "Vessel",
    entityId: vessel.id,
    summary: `Added vessel ${vessel.name}${vessel.imo ? ` (IMO ${vessel.imo})` : ""}`,
  });

  revalidatePath("/vessels");
  redirect(`/vessels/${vessel.id}`);
}

export async function updateVesselAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("vessel:update");
  const id = String(formData.get("vesselId") ?? "");
  const parsed = parseVesselForm(formData);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const d = parsed.data;

  const vessel = await prisma.vessel.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!vessel) return fail("Vessel not found");

  const imoClash = d.imo
    ? await prisma.vessel.findFirst({ where: { imo: d.imo, id: { not: id } } })
    : null;
  if (imoClash) return fail("A vessel with this IMO number already exists");

  const codeClash = d.code
    ? await prisma.vessel.findFirst({
        where: { companyId: user.companyId, code: d.code, id: { not: id } },
      })
    : null;
  if (codeClash) return fail(`Vessel code "${d.code}" is already in use`);

  // Track exactly when a vessel leaves the fleet (needed for the "under
  // management by year" history chart, not just its current status).
  const archivedAt =
    d.status === "SOLD" ? (vessel.archivedAt ?? new Date()) : null;

  await prisma.vessel.update({
    where: { id: vessel.id },
    data: {
      name: d.name,
      code: d.code || null,
      imo: d.imo || null,
      officialNumber: d.officialNumber || null,
      callSign: d.callSign || null,
      mmsi: d.mmsi || null,
      flag: d.flag || null,
      type: d.type,
      classificationSociety: d.classificationSociety || null,
      yearBuilt: d.yearBuilt ?? null,
      grossTonnage: d.grossTonnage ?? null,
      loa: d.loa ?? null,
      breadth: d.breadth ?? null,
      depth: d.depth ?? null,
      status: d.status,
      capacityCbm: d.capacityCbm ?? null,
      netTonnage: d.netTonnage ?? null,
      deadweight: d.deadweight ?? null,
      tradeArea: d.tradeArea || null,
      registeredOwner: d.registeredOwner || null,
      headOwner: d.headOwner || null,
      charterer: d.charterer || null,
      yearWithSwan: d.yearWithSwan ?? null,
      lastDryDock: d.lastDryDock ?? null,
      dryDockPlace: d.dryDockPlace || null,
      nextDryDockDue: d.nextDryDockDue ?? null,
      archivedAt,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "Vessel",
    entityId: vessel.id,
    summary: `Updated vessel particulars for ${vessel.name}`,
  });

  revalidatePath(`/vessels/${vessel.id}`);
  revalidatePath("/vessels");
  return OK;
}

export async function deleteVesselAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("vessel:delete");
  const id = String(formData.get("vesselId") ?? "");

  const vessel = await prisma.vessel.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!vessel) return fail("Vessel not found");

  await prisma.vessel.update({
    where: { id: vessel.id },
    data: { deletedAt: new Date(), deletedBy: user.id },
  });

  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "Vessel",
    entityId: vessel.id,
    summary: `Removed vessel ${vessel.name}${vessel.imo ? ` (IMO ${vessel.imo})` : ""}`,
  });

  revalidatePath("/vessels");
  redirect("/vessels");
}
