"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { requireUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { allocateRefNo } from "@/lib/ref-sequence";
import {
  createCdiSchema,
  addObservationSchema,
  updateObservationSchema,
} from "./schema";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

async function nextRefNo(companyId: string, vesselCode: string | null): Promise<string> {
  const year = new Date().getFullYear();
  return allocateRefNo(companyId, vesselCode ? `${vesselCode}-CDI-${year}` : `CDI-${year}`);
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

  let vesselCode: string | null = null;
  if (d.vesselId) {
    const vessel = await prisma.vessel.findFirst({
      where: { id: d.vesselId, companyId: user.companyId },
      select: { code: true },
    });
    if (!vessel) return fail("Vessel not found");
    vesselCode = vessel.code;
  }

  const insp = await prisma.cdiInspection.create({
    data: {
      companyId: user.companyId,
      refNo: await nextRefNo(user.companyId, vesselCode),
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
    category: formData.get("category"),
    observation: formData.get("observation"),
    rootCauseCategory: formData.get("rootCauseCategory"),
    rootCauseSubCategory: formData.get("rootCauseSubCategory"),
    rootCause: formData.get("rootCause"),
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
      category: d.category,
      observation: d.observation,
      rootCauseCategory: d.rootCauseCategory,
      rootCauseSubCategory: d.rootCauseSubCategory || null,
      rootCause: d.rootCause || null,
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
  const user = await requireUser();
  const parsed = updateObservationSchema.safeParse({
    observationId: formData.get("observationId"),
    response: formData.get("response"),
    status: formData.get("status"),
    category: formData.get("category"),
    rootCauseCategory: formData.get("rootCauseCategory"),
    rootCauseSubCategory: formData.get("rootCauseSubCategory"),
    rootCause: formData.get("rootCause"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const obs = await prisma.cdiObservation.findFirst({
    where: { id: d.observationId, companyId: user.companyId, deletedAt: null },
    include: { inspection: { select: { vesselId: true } } },
  });
  if (!obs) return fail("Observation not found");

  const hasFullAccess = user.permissions.has("cdi:update");
  // Narrower path: the vessel can respond to and close its own inspection's
  // observations (response + status only) without the full office edit
  // permission — category/root-cause classification stay office-authored.
  const hasRespondAccess =
    !hasFullAccess &&
    user.permissions.has("cdi:respond") &&
    obs.inspection.vesselId !== null &&
    obs.inspection.vesselId === user.vesselId;
  if (!hasFullAccess && !hasRespondAccess) {
    return fail("You don't have permission to edit this observation");
  }

  await prisma.cdiObservation.update({
    where: { id: obs.id },
    data: hasFullAccess
      ? {
          response: d.response || null,
          status: d.status,
          category: d.category,
          rootCauseCategory: d.rootCauseCategory,
          rootCauseSubCategory: d.rootCauseSubCategory || null,
          rootCause: d.rootCause || null,
        }
      : {
          response: d.response || null,
          status: d.status,
        },
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "CdiObservation",
    entityId: obs.id,
    summary: `Updated CDI observation (status: ${d.status})`,
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

  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "CdiObservation",
    entityId: obs.id,
    summary: `Deleted CDI observation`,
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
