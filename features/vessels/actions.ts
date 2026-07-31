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

  const existing = await prisma.vessel.findUnique({ where: { imo: d.imo } });
  if (existing) return fail("A vessel with this IMO number already exists");

  const codeClash = await prisma.vessel.findFirst({
    where: { companyId: user.companyId, code: d.code },
  });
  if (codeClash) return fail(`Vessel code "${d.code}" is already in use`);

  const vessel = await prisma.vessel.create({
    data: {
      companyId: user.companyId,
      name: d.name,
      code: d.code,
      imo: d.imo,
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
      createdBy: user.id,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "Vessel",
    entityId: vessel.id,
    summary: `Added vessel ${vessel.name} (IMO ${vessel.imo})`,
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

  const imoClash = await prisma.vessel.findFirst({
    where: { imo: d.imo, id: { not: id } },
  });
  if (imoClash) return fail("A vessel with this IMO number already exists");

  const codeClash = await prisma.vessel.findFirst({
    where: { companyId: user.companyId, code: d.code, id: { not: id } },
  });
  if (codeClash) return fail(`Vessel code "${d.code}" is already in use`);

  await prisma.vessel.update({
    where: { id: vessel.id },
    data: {
      name: d.name,
      code: d.code,
      imo: d.imo,
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
    summary: `Removed vessel ${vessel.name} (IMO ${vessel.imo})`,
  });

  revalidatePath("/vessels");
  redirect("/vessels");
}
