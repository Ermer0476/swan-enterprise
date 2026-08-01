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
  addCommentSchema,
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
    inspectionType: formData.get("inspectionType"),
    overallResult: formData.get("overallResult"),
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
      inspectorName: d.inspectorName,
      port: d.port || null,
      inspectionDate: new Date(d.inspectionDate),
      inspectionType: d.inspectionType || null,
      overallResult: d.overallResult || null,
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
    chapter: formData.get("chapter"),
    category: formData.get("category"),
    viqRef: formData.get("viqRef"),
    question: formData.get("question"),
    observation: formData.get("observation"),
    immediateCause: formData.get("immediateCause"),
    rootCauseCategory: formData.get("rootCauseCategory"),
    rootCauseSubCategory: formData.get("rootCauseSubCategory"),
    rootCause: formData.get("rootCause"),
    correctiveAction: formData.get("correctiveAction"),
    preventiveMeasure: formData.get("preventiveMeasure"),
    responsiblePersonId: formData.get("responsiblePersonId"),
    targetDate: formData.get("targetDate"),
    actualCompletionDate: formData.get("actualCompletionDate"),
    status: formData.get("status") || "OPEN",
    verifiedById: formData.get("verifiedById"),
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

  const seq = (await prisma.sireObservation.count({ where: { inspectionId: insp.id } })) + 1;

  await prisma.sireObservation.create({
    data: {
      companyId: user.companyId,
      inspectionId: insp.id,
      seq,
      chapter: d.chapter || null,
      category: d.category || null,
      viqRef: d.viqRef || null,
      question: d.question || null,
      observation: d.observation,
      immediateCause: d.immediateCause || null,
      rootCauseCategory: d.rootCauseCategory || null,
      rootCauseSubCategory: d.rootCauseSubCategory || null,
      rootCause: d.rootCause || null,
      correctiveAction: d.correctiveAction || null,
      preventiveMeasure: d.preventiveMeasure || null,
      responsiblePersonId: d.responsiblePersonId || null,
      targetDate: d.targetDate ? new Date(d.targetDate) : null,
      actualCompletionDate: d.actualCompletionDate ? new Date(d.actualCompletionDate) : null,
      status: d.status,
      verifiedById: d.verifiedById || null,
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
    summary: `Added observation ${seq} to ${insp.refNo}`,
  });

  revalidatePath(`/sire/${insp.id}`);
  return OK;
}

export async function updateObservationAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("sire:update");
  const parsed = updateObservationSchema.safeParse({
    observationId: formData.get("observationId"),
    chapter: formData.get("chapter"),
    category: formData.get("category"),
    viqRef: formData.get("viqRef"),
    question: formData.get("question"),
    observation: formData.get("observation"),
    immediateCause: formData.get("immediateCause"),
    rootCauseCategory: formData.get("rootCauseCategory"),
    rootCauseSubCategory: formData.get("rootCauseSubCategory"),
    rootCause: formData.get("rootCause"),
    correctiveAction: formData.get("correctiveAction"),
    preventiveMeasure: formData.get("preventiveMeasure"),
    responsiblePersonId: formData.get("responsiblePersonId"),
    targetDate: formData.get("targetDate"),
    actualCompletionDate: formData.get("actualCompletionDate"),
    status: formData.get("status") || "OPEN",
    verifiedById: formData.get("verifiedById"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const obs = await prisma.sireObservation.findFirst({
    where: { id: d.observationId, companyId: user.companyId, deletedAt: null },
  });
  if (!obs) return fail("Observation not found");

  await prisma.sireObservation.update({
    where: { id: obs.id },
    data: {
      chapter: d.chapter || null,
      category: d.category || null,
      viqRef: d.viqRef || null,
      question: d.question || null,
      observation: d.observation,
      immediateCause: d.immediateCause || null,
      rootCauseCategory: d.rootCauseCategory || null,
      rootCauseSubCategory: d.rootCauseSubCategory || null,
      rootCause: d.rootCause || null,
      correctiveAction: d.correctiveAction || null,
      preventiveMeasure: d.preventiveMeasure || null,
      responsiblePersonId: d.responsiblePersonId || null,
      targetDate: d.targetDate ? new Date(d.targetDate) : null,
      actualCompletionDate: d.actualCompletionDate ? new Date(d.actualCompletionDate) : null,
      status: d.status,
      verifiedById: d.verifiedById || null,
    },
  });

  revalidatePath(`/sire/${obs.inspectionId}`);
  return OK;
}

export async function deleteObservationAction(formData: FormData): Promise<ActionResult> {
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

export async function addCommentAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("sire:update");
  const parsed = addCommentSchema.safeParse({
    observationId: formData.get("observationId"),
    body: formData.get("body"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const obs = await prisma.sireObservation.findFirst({
    where: { id: d.observationId, companyId: user.companyId, deletedAt: null },
  });
  if (!obs) return fail("Observation not found");

  await prisma.sireObservationComment.create({
    data: {
      companyId: user.companyId,
      observationId: obs.id,
      authorId: user.id,
      body: d.body,
    },
  });

  revalidatePath(`/sire/${obs.inspectionId}`);
  return OK;
}

export async function closeSireAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("sire:close");
  const id = String(formData.get("inspectionId") ?? "");
  const insp = await prisma.sireInspection.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
    include: {
      observations: { where: { deletedAt: null, status: { not: "CLOSED" } } },
    },
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
