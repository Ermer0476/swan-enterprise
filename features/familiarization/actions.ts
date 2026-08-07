"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { createFamiliarizationSchema } from "./schema";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

// Reuses the drill:* permission keys — familiarization logging shares the
// exact same audience and workflow as drills (office full CRUD, Ship
// Officer logs/edits their own vessel), so a separate permission namespace
// would just duplicate every role grant for no behavioral difference.
export async function createFamiliarizationRecordAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("drill:create");
  const parsed = createFamiliarizationSchema.safeParse({
    vesselId: formData.get("vesselId"),
    scheduleItemId: formData.get("scheduleItemId"),
    completedDate: formData.get("completedDate"),
    notedBy: formData.get("notedBy"),
    remarks: formData.get("remarks"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const record = await prisma.familiarizationRecord.create({
    data: {
      companyId: user.companyId,
      vesselId: d.vesselId,
      scheduleItemId: d.scheduleItemId,
      completedDate: new Date(d.completedDate),
      notedBy: d.notedBy || null,
      remarks: d.remarks || null,
      createdBy: user.id,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "FamiliarizationRecord",
    entityId: record.id,
    summary: "Recorded a familiarization completion",
  });

  revalidatePath("/drills/matrix");
  return OK;
}

export async function deleteFamiliarizationRecordAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("drill:delete");
  const id = String(formData.get("recordId") ?? "");
  const record = await prisma.familiarizationRecord.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!record) return fail("Record not found");

  await prisma.familiarizationRecord.update({
    where: { id: record.id },
    data: { deletedAt: new Date(), deletedBy: user.id },
  });

  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "FamiliarizationRecord",
    entityId: record.id,
    summary: "Deleted a familiarization completion",
  });

  revalidatePath("/drills/matrix");
  return OK;
}
