"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { allocateRefNo } from "@/lib/ref-sequence";
import {
  createCompanyInspectionSchema,
  updateCompanyInspectionDetailsSchema,
  updateCinspTargetSchema,
  addObservationSchema,
  updateObservationSchema,
  observationRootCauseSchema,
} from "./schema";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

async function nextRefNo(companyId: string, vesselCode: string | null): Promise<string> {
  const year = new Date().getFullYear();
  return allocateRefNo(companyId, vesselCode ? `${vesselCode}-CI-${year}` : `CI-${year}`);
}

export async function createCompanyInspectionAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("cinsp:create");
  const parsed = createCompanyInspectionSchema.safeParse({
    vesselId: formData.get("vesselId"),
    inspectionType: formData.get("inspectionType"),
    visitKind: formData.get("visitKind"),
    inspectorName: formData.get("inspectorName"),
    port: formData.get("port"),
    inspectionDate: formData.get("inspectionDate"),
    summary: formData.get("summary"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
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

  const insp = await prisma.companyInspection.create({
    data: {
      companyId: user.companyId,
      refNo: await nextRefNo(user.companyId, vesselCode),
      vesselId: d.vesselId || null,
      inspectionType: d.inspectionType || null,
      visitKind: d.visitKind || null,
      inspectorName: d.inspectorName || null,
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
    entityType: "CompanyInspection",
    entityId: insp.id,
    summary: `Recorded company inspection ${insp.refNo}`,
  });

  revalidatePath("/company-inspections");
  redirect(`/company-inspections/${insp.id}`);
}

/** Fills in header details (type, kind of inspection, port, inspector) on an
 * inspection that was recorded before those fields existed or without them
 * — a lightweight patch, not a full edit of the inspection record. */
export async function updateCompanyInspectionDetailsAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("cinsp:update");
  const parsed = updateCompanyInspectionDetailsSchema.safeParse({
    inspectionId: formData.get("inspectionId"),
    inspectionType: formData.get("inspectionType"),
    visitKind: formData.get("visitKind"),
    inspectorName: formData.get("inspectorName"),
    port: formData.get("port"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const insp = await prisma.companyInspection.findFirst({
    where: { id: d.inspectionId, companyId: user.companyId, deletedAt: null },
  });
  if (!insp) return fail("Inspection not found");

  await prisma.companyInspection.update({
    where: { id: insp.id },
    data: {
      inspectionType: d.inspectionType || null,
      visitKind: d.visitKind || null,
      inspectorName: d.inspectorName || null,
      port: d.port || null,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "CompanyInspection",
    entityId: insp.id,
    summary: `Updated inspection details for ${insp.refNo}`,
  });

  revalidatePath(`/company-inspections/${insp.id}`);
  revalidatePath("/company-inspections");
  return OK;
}

export async function addObservationAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("cinsp:update");
  const parsed = addObservationSchema.safeParse({
    inspectionId: formData.get("inspectionId"),
    chapter: formData.get("chapter"),
    category: formData.get("category"),
    viqRef: formData.get("viqRef"),
    observation: formData.get("observation"),
    immediateCause: formData.get("immediateCause"),
    rootCauseCategory: formData.get("rootCauseCategory"),
    rootCauseSubCategory: formData.get("rootCauseSubCategory"),
    rootCause: formData.get("rootCause"),
    immediateCorrectiveAction: formData.get("immediateCorrectiveAction"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const insp = await prisma.companyInspection.findFirst({
    where: { id: d.inspectionId, companyId: user.companyId, deletedAt: null },
  });
  if (!insp) return fail("Inspection not found");
  if (insp.status === "CLOSED") return fail("Inspection is closed");

  const seq = (await prisma.companyInspectionObservation.count({ where: { inspectionId: insp.id } })) + 1;

  await prisma.companyInspectionObservation.create({
    data: {
      companyId: user.companyId,
      inspectionId: insp.id,
      seq,
      chapter: d.chapter || null,
      category: d.category || null,
      viqRef: d.viqRef || null,
      observation: d.observation,
      immediateCause: d.immediateCause || null,
      rootCauseCategory: d.rootCauseCategory || null,
      rootCauseSubCategory: d.rootCauseSubCategory || null,
      rootCause: d.rootCause || null,
      immediateCorrectiveAction: d.immediateCorrectiveAction || null,
      createdBy: user.id,
    },
  });
  if (insp.status === "OPEN") {
    await prisma.companyInspection.update({
      where: { id: insp.id },
      data: { status: "IN_PROGRESS", updatedBy: user.id },
    });
  }

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "CompanyInspectionObservation",
    entityId: insp.id,
    summary: `Added observation ${seq} to ${insp.refNo}`,
  });

  revalidatePath(`/company-inspections/${insp.id}`);
  return OK;
}

export async function updateObservationAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("cinsp:update");
  const parsed = updateObservationSchema.safeParse({
    observationId: formData.get("observationId"),
    chapter: formData.get("chapter"),
    category: formData.get("category"),
    viqRef: formData.get("viqRef"),
    observation: formData.get("observation"),
    immediateCause: formData.get("immediateCause"),
    rootCauseCategory: formData.get("rootCauseCategory"),
    rootCauseSubCategory: formData.get("rootCauseSubCategory"),
    rootCause: formData.get("rootCause"),
    immediateCorrectiveAction: formData.get("immediateCorrectiveAction"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const obs = await prisma.companyInspectionObservation.findFirst({
    where: { id: d.observationId, companyId: user.companyId, deletedAt: null },
  });
  if (!obs) return fail("Observation not found");

  await prisma.companyInspectionObservation.update({
    where: { id: obs.id },
    data: {
      chapter: d.chapter || null,
      category: d.category || null,
      viqRef: d.viqRef || null,
      observation: d.observation,
      immediateCause: d.immediateCause || null,
      rootCauseCategory: d.rootCauseCategory || null,
      rootCauseSubCategory: d.rootCauseSubCategory || null,
      rootCause: d.rootCause || null,
      immediateCorrectiveAction: d.immediateCorrectiveAction || null,
    },
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "CompanyInspectionObservation",
    entityId: obs.id,
    summary: `Updated company inspection observation`,
  });

  revalidatePath(`/company-inspections/${obs.inspectionId}`);
  return OK;
}

export async function saveObservationRootCauseAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("cinsp:update");
  const parsed = observationRootCauseSchema.safeParse({
    observationId: formData.get("observationId"),
    rootCauseCategory: formData.get("rootCauseCategory"),
    rootCauseSubCategory: formData.get("rootCauseSubCategory"),
    rootCause: formData.get("rootCause"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const obs = await prisma.companyInspectionObservation.findFirst({
    where: { id: d.observationId, companyId: user.companyId, deletedAt: null },
  });
  if (!obs) return fail("Observation not found");

  await prisma.companyInspectionObservation.update({
    where: { id: obs.id },
    data: {
      rootCauseCategory: d.rootCauseCategory,
      rootCauseSubCategory: d.rootCauseSubCategory,
      rootCause: d.rootCause || null,
    },
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "CompanyInspectionObservation",
    entityId: obs.id,
    summary: `Recorded root cause for company inspection observation`,
  });

  revalidatePath(`/company-inspections/${obs.inspectionId}`);
  return OK;
}

export async function deleteObservationAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("cinsp:update");
  const id = String(formData.get("observationId") ?? "");
  const obs = await prisma.companyInspectionObservation.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!obs) return fail("Observation not found");
  await prisma.companyInspectionObservation.update({
    where: { id: obs.id },
    data: { deletedAt: new Date() },
  });

  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "CompanyInspectionObservation",
    entityId: obs.id,
    summary: `Deleted company inspection observation`,
  });

  revalidatePath(`/company-inspections/${obs.inspectionId}`);
  return OK;
}

export async function closeCompanyInspectionAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("cinsp:close");
  const id = String(formData.get("inspectionId") ?? "");
  const insp = await prisma.companyInspection.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
    include: { observations: { where: { deletedAt: null }, select: { id: true } } },
  });
  if (!insp) return fail("Inspection not found");
  if (insp.status === "CLOSED") return fail("Inspection is already closed");

  // Unlike Internal/External Audit, an observation here doesn't need a CAPA
  // row at all — many are fully resolved by the Immediate Corrective Action
  // alone. Only block closing on CAPA rows that are still open.
  const openCapaCount = await prisma.capaAction.count({
    where: {
      companyId: user.companyId,
      deletedAt: null,
      entityType: "CompanyInspectionObservation",
      entityId: { in: insp.observations.map((o) => o.id) },
      status: { not: "CLOSED" },
    },
  });
  if (openCapaCount > 0) {
    return fail(`Close all CAPA items before closing the inspection (${openCapaCount} still open).`);
  }

  await prisma.companyInspection.update({
    where: { id: insp.id },
    data: { status: "CLOSED", closedAt: new Date(), updatedBy: user.id },
  });
  await writeAudit({
    actor: user,
    action: "APPROVE",
    entityType: "CompanyInspection",
    entityId: insp.id,
    summary: `Closed company inspection ${insp.refNo}`,
  });

  revalidatePath(`/company-inspections/${insp.id}`);
  return OK;
}

export async function deleteCompanyInspectionAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("cinsp:delete");
  const id = String(formData.get("inspectionId") ?? "");
  const insp = await prisma.companyInspection.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!insp) return fail("Inspection not found");
  await prisma.companyInspection.update({
    where: { id: insp.id },
    data: { deletedAt: new Date(), deletedBy: user.id },
  });
  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "CompanyInspection",
    entityId: insp.id,
    summary: `Deleted company inspection ${insp.refNo}`,
  });
  revalidatePath("/company-inspections");
  redirect("/company-inspections");
}

export async function updateCinspTargetAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("cinsp:manage-targets");
  const parsed = updateCinspTargetSchema.safeParse({
    avgObservationTarget: formData.get("avgObservationTarget"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  await prisma.company.update({
    where: { id: user.companyId },
    data: { cinspAvgObservationTarget: d.avgObservationTarget },
  });
  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "Company",
    entityId: user.companyId,
    summary: `Set Company Inspection KPI target to Average Observations ≤ ${d.avgObservationTarget}`,
  });
  revalidatePath("/company-inspections/kpi");
  revalidatePath("/settings/company-inspections-kpi");
  return OK;
}
