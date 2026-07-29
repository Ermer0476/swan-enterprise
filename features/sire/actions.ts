"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import {
  createSireSchema,
  addObservationSchema,
  updateObservationSchema,
} from "./schema";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

async function nextRefNo(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `SIRE-${year}-`;
  const count = await prisma.sireInspection.count({
    where: { companyId, refNo: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

export async function createSireAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("sire:create");
  const parsed = createSireSchema.safeParse({
    vesselId: formData.get("vesselId"),
    inspectingCompany: formData.get("inspectingCompany"),
    inspectorName: formData.get("inspectorName"),
    port: formData.get("port"),
    inspectionDate: formData.get("inspectionDate"),
    sireVersion: formData.get("sireVersion"),
    summary: formData.get("summary"),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const d = parsed.data;

  const insp = await prisma.sireInspection.create({
    data: {
      companyId: user.companyId,
      refNo: await nextRefNo(user.companyId),
      vesselId: d.vesselId || null,
      inspectingCompany: d.inspectingCompany,
      inspectorName: d.inspectorName || null,
      port: d.port || null,
      inspectionDate: new Date(d.inspectionDate),
      sireVersion: d.sireVersion || "2.0",
      summary: d.summary || null,
      status: "OPEN",
      createdBy: user.id,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "SireInspection",
    entityId: insp.id,
    summary: `Recorded SIRE inspection ${insp.refNo}`,
  });

  revalidatePath("/sire");
  redirect(`/sire/${insp.id}`);
}

export async function addObservationAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("sire:update");
  const parsed = addObservationSchema.safeParse({
    inspectionId: formData.get("inspectionId"),
    viqRef: formData.get("viqRef"),
    category: formData.get("category"),
    observation: formData.get("observation"),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const d = parsed.data;

  const insp = await prisma.sireInspection.findFirst({
    where: { id: d.inspectionId, companyId: user.companyId, deletedAt: null },
  });
  if (!insp) return fail("Inspection not found");
  if (insp.status === "CLOSED") return fail("Inspection is closed");

  await prisma.sireObservation.create({
    data: {
      companyId: user.companyId,
      inspectionId: insp.id,
      viqRef: d.viqRef || null,
      category: d.category || null,
      observation: d.observation,
      status: "OPEN",
      createdBy: user.id,
    },
  });
  if (insp.status === "OPEN") {
    await prisma.sireInspection.update({
      where: { id: insp.id },
      data: { status: "IN_PROGRESS", updatedBy: user.id },
    });
  }

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "SireObservation",
    entityId: insp.id,
    summary: `Added observation to ${insp.refNo}`,
  });

  revalidatePath(`/sire/${insp.id}`);
  return OK;
}

export async function updateObservationAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("sire:update");
  const parsed = updateObservationSchema.safeParse({
    observationId: formData.get("observationId"),
    response: formData.get("response"),
    status: formData.get("status"),
  });
  if (!parsed.success) return fail("Invalid input");
  const d = parsed.data;

  const obs = await prisma.sireObservation.findFirst({
    where: { id: d.observationId, companyId: user.companyId, deletedAt: null },
  });
  if (!obs) return fail("Observation not found");

  await prisma.sireObservation.update({
    where: { id: obs.id },
    data: { response: d.response || null, status: d.status },
  });

  revalidatePath(`/sire/${obs.inspectionId}`);
  return OK;
}

export async function deleteObservationAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("sire:update");
  const id = String(formData.get("observationId") ?? "");
  const obs = await prisma.sireObservation.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!obs) return fail("Observation not found");
  await prisma.sireObservation.update({
    where: { id: obs.id },
    data: { deletedAt: new Date() },
  });
  revalidatePath(`/sire/${obs.inspectionId}`);
  return OK;
}

export async function closeSireAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("sire:close");
  const id = String(formData.get("inspectionId") ?? "");
  const insp = await prisma.sireInspection.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
    include: { observations: { where: { deletedAt: null, status: "OPEN" } } },
  });
  if (!insp) return fail("Inspection not found");
  if (insp.status === "CLOSED") return fail("Inspection is already closed");
  if (insp.observations.length > 0) {
    return fail("Close all observations before closing the inspection");
  }

  await prisma.sireInspection.update({
    where: { id: insp.id },
    data: { status: "CLOSED", closedAt: new Date(), updatedBy: user.id },
  });
  await writeAudit({
    actor: user,
    action: "APPROVE",
    entityType: "SireInspection",
    entityId: insp.id,
    summary: `Closed SIRE inspection ${insp.refNo}`,
  });

  revalidatePath(`/sire/${insp.id}`);
  return OK;
}

export async function deleteSireAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("sire:delete");
  const id = String(formData.get("inspectionId") ?? "");
  const insp = await prisma.sireInspection.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!insp) return fail("Inspection not found");
  await prisma.sireInspection.update({
    where: { id: insp.id },
    data: { deletedAt: new Date(), deletedBy: user.id },
  });
  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "SireInspection",
    entityId: insp.id,
    summary: `Deleted SIRE inspection ${insp.refNo}`,
  });
  revalidatePath("/sire");
  redirect("/sire");
}
