"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import {
  createCdiSchema,
  addObservationSchema,
  updateObservationSchema,
} from "./schema";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

async function nextRefNo(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `CDI-${year}-`;
  const count = await prisma.cdiInspection.count({
    where: { companyId, refNo: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

export async function createCdiAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("cdi:create");
  const parsed = createCdiSchema.safeParse({
    vesselId: formData.get("vesselId"),
    inspectorName: formData.get("inspectorName"),
    scheme: formData.get("scheme"),
    port: formData.get("port"),
    inspectionDate: formData.get("inspectionDate"),
    summary: formData.get("summary"),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const d = parsed.data;

  const insp = await prisma.cdiInspection.create({
    data: {
      companyId: user.companyId,
      refNo: await nextRefNo(user.companyId),
      vesselId: d.vesselId || null,
      inspectorName: d.inspectorName || null,
      scheme: d.scheme || "CDI-M",
      port: d.port || null,
      inspectionDate: new Date(d.inspectionDate),
      summary: d.summary || null,
      status: "OPEN",
      createdBy: user.id,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "CdiInspection",
    entityId: insp.id,
    summary: `Recorded CDI inspection ${insp.refNo}`,
  });

  revalidatePath("/cdi");
  redirect(`/cdi/${insp.id}`);
}

export async function addObservationAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("cdi:update");
  const parsed = addObservationSchema.safeParse({
    inspectionId: formData.get("inspectionId"),
    questionRef: formData.get("questionRef"),
    observation: formData.get("observation"),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const d = parsed.data;

  const insp = await prisma.cdiInspection.findFirst({
    where: { id: d.inspectionId, companyId: user.companyId, deletedAt: null },
  });
  if (!insp) return fail("Inspection not found");
  if (insp.status === "CLOSED") return fail("Inspection is closed");

  await prisma.cdiObservation.create({
    data: {
      companyId: user.companyId,
      inspectionId: insp.id,
      questionRef: d.questionRef || null,
      observation: d.observation,
      status: "OPEN",
      createdBy: user.id,
    },
  });
  if (insp.status === "OPEN") {
    await prisma.cdiInspection.update({
      where: { id: insp.id },
      data: { status: "IN_PROGRESS", updatedBy: user.id },
    });
  }

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "CdiObservation",
    entityId: insp.id,
    summary: `Added observation to ${insp.refNo}`,
  });

  revalidatePath(`/cdi/${insp.id}`);
  return OK;
}

export async function updateObservationAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("cdi:update");
  const parsed = updateObservationSchema.safeParse({
    observationId: formData.get("observationId"),
    response: formData.get("response"),
    status: formData.get("status"),
  });
  if (!parsed.success) return fail("Invalid input");
  const d = parsed.data;

  const obs = await prisma.cdiObservation.findFirst({
    where: { id: d.observationId, companyId: user.companyId, deletedAt: null },
  });
  if (!obs) return fail("Observation not found");

  await prisma.cdiObservation.update({
    where: { id: obs.id },
    data: { response: d.response || null, status: d.status },
  });

  revalidatePath(`/cdi/${obs.inspectionId}`);
  return OK;
}

export async function deleteObservationAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("cdi:update");
  const id = String(formData.get("observationId") ?? "");
  const obs = await prisma.cdiObservation.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!obs) return fail("Observation not found");
  await prisma.cdiObservation.update({
    where: { id: obs.id },
    data: { deletedAt: new Date() },
  });
  revalidatePath(`/cdi/${obs.inspectionId}`);
  return OK;
}

export async function closeCdiAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("cdi:close");
  const id = String(formData.get("inspectionId") ?? "");
  const insp = await prisma.cdiInspection.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
    include: { observations: { where: { deletedAt: null, status: "OPEN" } } },
  });
  if (!insp) return fail("Inspection not found");
  if (insp.status === "CLOSED") return fail("Inspection is already closed");
  if (insp.observations.length > 0) {
    return fail("Close all observations before closing the inspection");
  }

  await prisma.cdiInspection.update({
    where: { id: insp.id },
    data: { status: "CLOSED", closedAt: new Date(), updatedBy: user.id },
  });
  await writeAudit({
    actor: user,
    action: "APPROVE",
    entityType: "CdiInspection",
    entityId: insp.id,
    summary: `Closed CDI inspection ${insp.refNo}`,
  });

  revalidatePath(`/cdi/${insp.id}`);
  return OK;
}

export async function deleteCdiAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("cdi:delete");
  const id = String(formData.get("inspectionId") ?? "");
  const insp = await prisma.cdiInspection.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!insp) return fail("Inspection not found");
  await prisma.cdiInspection.update({
    where: { id: insp.id },
    data: { deletedAt: new Date(), deletedBy: user.id },
  });
  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "CdiInspection",
    entityId: insp.id,
    summary: `Deleted CDI inspection ${insp.refNo}`,
  });
  revalidatePath("/cdi");
  redirect("/cdi");
}
