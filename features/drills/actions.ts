"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { createDrillSchema } from "./schema";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

async function nextRefNo(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `DR-${year}-`;
  const count = await prisma.emergencyDrill.count({
    where: { companyId, refNo: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

export async function createDrillAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("drill:create");
  const parsed = createDrillSchema.safeParse({
    vesselId: formData.get("vesselId"),
    drillType: formData.get("drillType"),
    drillDate: formData.get("drillDate"),
    scenario: formData.get("scenario"),
    participants: formData.get("participants"),
    conductedBy: formData.get("conductedBy"),
    observations: formData.get("observations"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const drill = await prisma.emergencyDrill.create({
    data: {
      companyId: user.companyId,
      refNo: await nextRefNo(user.companyId),
      vesselId: d.vesselId,
      drillType: d.drillType,
      drillDate: new Date(d.drillDate),
      scenario: d.scenario || null,
      participants: d.participants || null,
      conductedBy: d.conductedBy || null,
      observations: d.observations || null,
      status: "OPEN",
      createdBy: user.id,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "EmergencyDrill",
    entityId: drill.id,
    summary: `Recorded drill ${drill.refNo}`,
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
