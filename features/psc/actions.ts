"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import {
  createPscSchema,
  addDeficiencySchema,
  updateDeficiencySchema,
} from "./schema";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

async function nextRefNo(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PSC-${year}-`;
  const count = await prisma.pscInspection.count({
    where: { companyId, refNo: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

export async function createPscAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("psc:create");
  const parsed = createPscSchema.safeParse({
    vesselId: formData.get("vesselId"),
    authority: formData.get("authority"),
    mouRegion: formData.get("mouRegion"),
    port: formData.get("port"),
    inspectionDate: formData.get("inspectionDate"),
    detained: formData.get("detained") ?? "",
    summary: formData.get("summary"),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const d = parsed.data;

  const insp = await prisma.pscInspection.create({
    data: {
      companyId: user.companyId,
      refNo: await nextRefNo(user.companyId),
      vesselId: d.vesselId || null,
      authority: d.authority,
      mouRegion: d.mouRegion || null,
      port: d.port || null,
      inspectionDate: new Date(d.inspectionDate),
      detained: d.detained === "on",
      summary: d.summary || null,
      status: "OPEN",
      createdBy: user.id,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "PscInspection",
    entityId: insp.id,
    summary: `Recorded PSC inspection ${insp.refNo}${insp.detained ? " (DETAINED)" : ""}`,
  });

  revalidatePath("/psc");
  redirect(`/psc/${insp.id}`);
}

export async function addDeficiencyAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("psc:update");
  const parsed = addDeficiencySchema.safeParse({
    inspectionId: formData.get("inspectionId"),
    natureCode: formData.get("natureCode"),
    reference: formData.get("reference"),
    actionCode: formData.get("actionCode"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const d = parsed.data;

  const insp = await prisma.pscInspection.findFirst({
    where: { id: d.inspectionId, companyId: user.companyId, deletedAt: null },
  });
  if (!insp) return fail("Inspection not found");
  if (insp.status === "CLOSED") return fail("Inspection is closed");

  await prisma.pscDeficiency.create({
    data: {
      companyId: user.companyId,
      inspectionId: insp.id,
      natureCode: d.natureCode || null,
      reference: d.reference || null,
      actionCode: d.actionCode || null,
      description: d.description,
      status: "OPEN",
      createdBy: user.id,
    },
  });
  if (insp.status === "OPEN") {
    await prisma.pscInspection.update({
      where: { id: insp.id },
      data: { status: "IN_PROGRESS", updatedBy: user.id },
    });
  }

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "PscDeficiency",
    entityId: insp.id,
    summary: `Added deficiency to ${insp.refNo}`,
  });

  revalidatePath(`/psc/${insp.id}`);
  return OK;
}

export async function updateDeficiencyAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("psc:update");
  const parsed = updateDeficiencySchema.safeParse({
    deficiencyId: formData.get("deficiencyId"),
    rectification: formData.get("rectification"),
    status: formData.get("status"),
  });
  if (!parsed.success) return fail("Invalid input");
  const d = parsed.data;

  const def = await prisma.pscDeficiency.findFirst({
    where: { id: d.deficiencyId, companyId: user.companyId, deletedAt: null },
  });
  if (!def) return fail("Deficiency not found");

  await prisma.pscDeficiency.update({
    where: { id: def.id },
    data: { rectification: d.rectification || null, status: d.status },
  });

  revalidatePath(`/psc/${def.inspectionId}`);
  return OK;
}

export async function deleteDeficiencyAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("psc:update");
  const id = String(formData.get("deficiencyId") ?? "");
  const def = await prisma.pscDeficiency.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!def) return fail("Deficiency not found");
  await prisma.pscDeficiency.update({
    where: { id: def.id },
    data: { deletedAt: new Date() },
  });
  revalidatePath(`/psc/${def.inspectionId}`);
  return OK;
}

export async function closePscAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("psc:close");
  const id = String(formData.get("inspectionId") ?? "");
  const insp = await prisma.pscInspection.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
    include: { deficiencies: { where: { deletedAt: null, status: "OPEN" } } },
  });
  if (!insp) return fail("Inspection not found");
  if (insp.status === "CLOSED") return fail("Inspection is already closed");
  if (insp.deficiencies.length > 0) {
    return fail("Rectify all deficiencies before closing the inspection");
  }

  await prisma.pscInspection.update({
    where: { id: insp.id },
    data: { status: "CLOSED", closedAt: new Date(), updatedBy: user.id },
  });
  await writeAudit({
    actor: user,
    action: "APPROVE",
    entityType: "PscInspection",
    entityId: insp.id,
    summary: `Closed PSC inspection ${insp.refNo}`,
  });

  revalidatePath(`/psc/${insp.id}`);
  return OK;
}

export async function deletePscAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("psc:delete");
  const id = String(formData.get("inspectionId") ?? "");
  const insp = await prisma.pscInspection.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!insp) return fail("Inspection not found");
  await prisma.pscInspection.update({
    where: { id: insp.id },
    data: { deletedAt: new Date(), deletedBy: user.id },
  });
  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "PscInspection",
    entityId: insp.id,
    summary: `Deleted PSC inspection ${insp.refNo}`,
  });
  revalidatePath("/psc");
  redirect("/psc");
}
