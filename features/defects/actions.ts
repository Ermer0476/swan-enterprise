"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { createDefectSchema, updateDefectSchema } from "./schema";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

async function nextRefNo(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `DEF-${year}-`;
  const count = await prisma.defect.count({
    where: { companyId, refNo: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

export async function createDefectAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("defect:create");
  const parsed = createDefectSchema.safeParse({
    vesselId: formData.get("vesselId"),
    equipment: formData.get("equipment"),
    description: formData.get("description"),
    severity: formData.get("severity"),
    dateRaised: formData.get("dateRaised"),
    targetRectificationDate: formData.get("targetRectificationDate"),
    raisedBy: formData.get("raisedBy"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const defect = await prisma.defect.create({
    data: {
      companyId: user.companyId,
      refNo: await nextRefNo(user.companyId),
      vesselId: d.vesselId,
      equipment: d.equipment,
      description: d.description,
      severity: d.severity,
      dateRaised: new Date(d.dateRaised),
      targetRectificationDate: d.targetRectificationDate ? new Date(d.targetRectificationDate) : null,
      raisedBy: d.raisedBy || null,
      status: "OPEN",
      createdBy: user.id,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "Defect",
    entityId: defect.id,
    summary: `Reported defect ${defect.refNo} — ${defect.equipment}`,
  });

  revalidatePath("/defects");
  redirect(`/defects/${defect.id}`);
}

export async function updateDefectAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("defect:update");
  const parsed = updateDefectSchema.safeParse({
    defectId: formData.get("defectId"),
    status: formData.get("status"),
    actionTaken: formData.get("actionTaken"),
  });
  if (!parsed.success) return fail("Invalid input");
  const d = parsed.data;

  const defect = await prisma.defect.findFirst({
    where: { id: d.defectId, companyId: user.companyId, deletedAt: null },
  });
  if (!defect) return fail("Defect not found");

  await prisma.defect.update({
    where: { id: defect.id },
    data: {
      status: d.status,
      actionTaken: d.actionTaken || null,
      rectifiedAt: d.status === "RECTIFIED" ? new Date() : defect.status === "RECTIFIED" ? null : defect.rectifiedAt,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "Defect",
    entityId: defect.id,
    summary: `${defect.refNo} set to ${d.status}`,
  });

  revalidatePath(`/defects/${defect.id}`);
  return OK;
}

export async function deleteDefectAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("defect:delete");
  const id = String(formData.get("defectId") ?? "");
  const defect = await prisma.defect.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!defect) return fail("Defect not found");

  await prisma.defect.update({
    where: { id: defect.id },
    data: { deletedAt: new Date(), deletedBy: user.id },
  });

  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "Defect",
    entityId: defect.id,
    summary: `Deleted defect ${defect.refNo}`,
  });

  revalidatePath("/defects");
  redirect("/defects");
}
