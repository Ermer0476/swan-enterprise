"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { allocateRefNo } from "@/lib/ref-sequence";
import type { DrillStatus } from "@/lib/generated/prisma";
import { createDrillSchema } from "./schema";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

// Prefixed with the vessel's fleet code (e.g. SWA-DR-2026-0001) so two
// ships' Nth drill of the year never look alike once everything lands in
// the office's central register.
async function nextRefNo(companyId: string, vesselCode: string): Promise<string> {
  return allocateRefNo(companyId, `${vesselCode}-DR-${new Date().getFullYear()}`);
}

export async function createDrillAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("drill:create");
  const parsed = createDrillSchema.safeParse({
    vesselId: formData.get("vesselId"),
    scheduleItemId: formData.get("scheduleItemId"),
    drillDate: formData.get("drillDate"),
    drillTime: formData.get("drillTime"),
    position: formData.get("position"),
    participants: formData.get("participants"),
    conductedBy: formData.get("conductedBy"),
    details: formData.get("details"),
    deficiencies: formData.get("deficiencies"),
    correctiveAction: formData.get("correctiveAction"),
    vesselRemarks: formData.get("vesselRemarks"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const vessel = await prisma.vessel.findFirst({
    where: { id: d.vesselId, companyId: user.companyId },
    select: { code: true },
  });
  if (!vessel) return fail("Vessel not found");

  const status: DrillStatus = formData.get("intent") === "draft" ? "DRAFT" : "OPEN";
  const drill = await prisma.emergencyDrill.create({
    data: {
      companyId: user.companyId,
      refNo: status === "OPEN" ? await nextRefNo(user.companyId, vessel.code) : null,
      vesselId: d.vesselId,
      scheduleItemId: d.scheduleItemId,
      drillDate: new Date(d.drillDate),
      drillTime: d.drillTime || null,
      position: d.position || null,
      participants: d.participants || null,
      conductedBy: d.conductedBy || null,
      details: d.details || null,
      deficiencies: d.deficiencies || null,
      correctiveAction: d.correctiveAction || null,
      vesselRemarks: d.vesselRemarks || null,
      status,
      createdBy: user.id,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "EmergencyDrill",
    entityId: drill.id,
    summary: status === "OPEN" ? `Recorded drill ${drill.refNo}` : `Saved draft drill record`,
  });

  revalidatePath("/drills");
  redirect(`/drills/${drill.id}`);
}

export async function closeDrillAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("drill:close");
  const id = String(formData.get("drillId") ?? "");
  const drill = await prisma.emergencyDrill.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!drill) return fail("Drill not found");
  if (drill.status === "DRAFT") return fail("Report this draft first");
  if (drill.status === "CLOSED") return fail("Already closed");

  await prisma.emergencyDrill.update({
    where: { id: drill.id },
    data: { status: "CLOSED", closedAt: new Date(), updatedBy: user.id },
  });

  await writeAudit({
    actor: user,
    action: "APPROVE",
    entityType: "EmergencyDrill",
    entityId: drill.id,
    summary: `Closed drill ${drill.refNo}`,
  });

  revalidatePath(`/drills/${drill.id}`);
  return OK;
}

export async function deleteDrillAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("drill:delete");
  const id = String(formData.get("drillId") ?? "");
  const drill = await prisma.emergencyDrill.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!drill) return fail("Drill not found");

  await prisma.emergencyDrill.update({
    where: { id: drill.id },
    data: { deletedAt: new Date(), deletedBy: user.id },
  });

  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "EmergencyDrill",
    entityId: drill.id,
    summary: `Deleted drill ${drill.refNo}`,
  });

  revalidatePath("/drills");
  redirect("/drills");
}

/** Submits a Draft — assigns its refNo (never done at draft-save time). */
export async function reportDraftDrillAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("drill:create");
  const id = String(formData.get("drillId") ?? "");
  const drill = await prisma.emergencyDrill.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null, status: "DRAFT" },
  });
  if (!drill) return fail("Draft not found");
  if (user.department !== "SHIPBOARD" && drill.createdBy !== user.id) {
    return fail("Only the draft's creator (or the vessel) can report this draft");
  }

  const vessel = await prisma.vessel.findFirst({
    where: { id: drill.vesselId, companyId: user.companyId },
    select: { code: true },
  });
  if (!vessel) return fail("Vessel not found");
  const refNo = await nextRefNo(user.companyId, vessel.code);

  await prisma.emergencyDrill.update({
    where: { id: drill.id },
    data: { status: "OPEN", refNo, updatedBy: user.id },
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "EmergencyDrill",
    entityId: drill.id,
    summary: `Recorded drill ${refNo}`,
  });

  revalidatePath("/drills");
  revalidatePath(`/drills/${drill.id}`);
  return OK;
}

/** Full edit of a Draft's own report fields — locked to DRAFT status only. */
export async function updateDraftDrillAction(
  drillId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("drill:create");
  const drill = await prisma.emergencyDrill.findFirst({
    where: { id: drillId, companyId: user.companyId, deletedAt: null, status: "DRAFT" },
  });
  if (!drill) return fail("Draft not found");
  if (user.department !== "SHIPBOARD" && drill.createdBy !== user.id) {
    return fail("Only the draft's creator (or the vessel) can edit this draft");
  }

  const parsed = createDrillSchema.safeParse({
    vesselId: formData.get("vesselId"),
    scheduleItemId: formData.get("scheduleItemId"),
    drillDate: formData.get("drillDate"),
    drillTime: formData.get("drillTime"),
    position: formData.get("position"),
    participants: formData.get("participants"),
    conductedBy: formData.get("conductedBy"),
    details: formData.get("details"),
    deficiencies: formData.get("deficiencies"),
    correctiveAction: formData.get("correctiveAction"),
    vesselRemarks: formData.get("vesselRemarks"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const vessel = await prisma.vessel.findFirst({
    where: { id: d.vesselId, companyId: user.companyId },
    select: { id: true },
  });
  if (!vessel) return fail("Vessel not found");

  await prisma.emergencyDrill.update({
    where: { id: drill.id },
    data: {
      vesselId: d.vesselId,
      scheduleItemId: d.scheduleItemId,
      drillDate: new Date(d.drillDate),
      drillTime: d.drillTime || null,
      position: d.position || null,
      participants: d.participants || null,
      conductedBy: d.conductedBy || null,
      details: d.details || null,
      deficiencies: d.deficiencies || null,
      correctiveAction: d.correctiveAction || null,
      vesselRemarks: d.vesselRemarks || null,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "EmergencyDrill",
    entityId: drill.id,
    summary: `Updated draft drill record`,
  });

  revalidatePath(`/drills/${drill.id}`);
  return OK;
}

/** Deletes its own Draft — soft delete, DRAFT status only. */
export async function deleteDraftDrillAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("drill:create");
  const id = String(formData.get("drillId") ?? "");
  const drill = await prisma.emergencyDrill.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null, status: "DRAFT" },
  });
  if (!drill) return fail("Draft not found");
  if (user.department !== "SHIPBOARD" && drill.createdBy !== user.id) {
    return fail("Only the draft's creator (or the vessel) can delete this draft");
  }

  await prisma.emergencyDrill.update({
    where: { id: drill.id },
    data: { deletedAt: new Date(), deletedBy: user.id },
  });
  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "EmergencyDrill",
    entityId: drill.id,
    summary: `Deleted draft drill record`,
  });

  revalidatePath("/drills");
  redirect("/drills");
}
