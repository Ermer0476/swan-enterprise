"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import type { HazardStatus } from "@/lib/generated/prisma";
import { createHazardSchema, actionHazardSchema, HAZARD_STATUSES } from "./schema";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

function nextStatus(current: HazardStatus): HazardStatus | null {
  const i = HAZARD_STATUSES.indexOf(current);
  return (HAZARD_STATUSES[i + 1] as HazardStatus | undefined) ?? null;
}

async function nextRefNo(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `HOR-${year}-`;
  const count = await prisma.hazardObservation.count({
    where: { companyId, refNo: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

export async function createHazardAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("hazard:create");
  const parsed = createHazardSchema.safeParse({
    title: formData.get("title"),
    vesselId: formData.get("vesselId"),
    observedAt: formData.get("observedAt"),
    location: formData.get("location"),
    category: formData.get("category"),
    hazardType: formData.get("hazardType"),
    riskLevel: formData.get("riskLevel"),
    observation: formData.get("observation"),
    immediateAction: formData.get("immediateAction"),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const d = parsed.data;

  const hazard = await prisma.hazardObservation.create({
    data: {
      companyId: user.companyId,
      refNo: await nextRefNo(user.companyId),
      title: d.title,
      vesselId: d.vesselId || null,
      observedAt: new Date(d.observedAt),
      location: d.location || null,
      category: d.category,
      hazardType: d.hazardType,
      riskLevel: d.riskLevel,
      observation: d.observation,
      immediateAction: d.immediateAction || null,
      status: "OPEN",
      reportedById: user.id,
      createdBy: user.id,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "HazardObservation",
    entityId: hazard.id,
    summary: `Submitted hazard observation ${hazard.refNo} — ${hazard.title}`,
  });

  revalidatePath("/hazards");
  redirect(`/hazards/${hazard.id}`);
}

export async function actionHazardAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("hazard:update");
  const parsed = actionHazardSchema.safeParse({
    hazardId: formData.get("hazardId"),
    correctiveAction: formData.get("correctiveAction"),
  });
  if (!parsed.success) return fail("Invalid input");

  const hazard = await prisma.hazardObservation.findFirst({
    where: { id: parsed.data.hazardId, companyId: user.companyId, deletedAt: null },
  });
  if (!hazard) return fail("Hazard observation not found");
  if (hazard.status === "CLOSED") return fail("Closed observations are read-only");

  await prisma.hazardObservation.update({
    where: { id: hazard.id },
    data: {
      correctiveAction: parsed.data.correctiveAction || null,
      status: hazard.status === "OPEN" ? "IN_PROGRESS" : hazard.status,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "HazardObservation",
    entityId: hazard.id,
    summary: `Actioned hazard observation ${hazard.refNo}`,
  });

  revalidatePath(`/hazards/${hazard.id}`);
  return OK;
}

export async function advanceHazardAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("hazard:update");
  const id = String(formData.get("hazardId") ?? "");
  const hazard = await prisma.hazardObservation.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!hazard) return fail("Hazard observation not found");

  const next = nextStatus(hazard.status);
  if (!next) return fail("Observation is already closed");
  if (next === "CLOSED" && !user.permissions.has("hazard:close")) {
    return fail("You don't have permission to close observations");
  }

  await prisma.hazardObservation.update({
    where: { id: hazard.id },
    data: {
      status: next,
      closedAt: next === "CLOSED" ? new Date() : hazard.closedAt,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: next === "CLOSED" ? "APPROVE" : "UPDATE",
    entityType: "HazardObservation",
    entityId: hazard.id,
    summary: `${hazard.refNo} advanced to ${next}`,
  });

  revalidatePath(`/hazards/${hazard.id}`);
  return OK;
}

export async function deleteHazardAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("hazard:delete");
  const id = String(formData.get("hazardId") ?? "");
  const hazard = await prisma.hazardObservation.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!hazard) return fail("Hazard observation not found");

  await prisma.hazardObservation.update({
    where: { id: hazard.id },
    data: { deletedAt: new Date(), deletedBy: user.id },
  });
  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "HazardObservation",
    entityId: hazard.id,
    summary: `Deleted hazard observation ${hazard.refNo}`,
  });

  revalidatePath("/hazards");
  redirect("/hazards");
}
