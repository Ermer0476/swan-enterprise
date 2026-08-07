"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

// Office-only (drill:close, same gate already used for Emergency Drill's
// office-only actions) — marking a checklist item N/A for a vessel is a
// vessel-equipment/compliance fact, not something the ship should toggle
// unilaterally.
export async function setScheduleApplicabilityAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("drill:close");
  const vesselId = String(formData.get("vesselId") ?? "");
  const scheduleItemId = String(formData.get("scheduleItemId") ?? "");
  const notApplicable = formData.get("notApplicable") === "true";
  if (!vesselId || !scheduleItemId) return fail("Missing vessel or item");

  const vessel = await prisma.vessel.findFirst({
    where: { id: vesselId, companyId: user.companyId, deletedAt: null },
  });
  if (!vessel) return fail("Vessel not found");

  if (notApplicable) {
    await prisma.scheduleApplicability.upsert({
      where: { companyId_vesselId_scheduleItemId: { companyId: user.companyId, vesselId, scheduleItemId } },
      create: { companyId: user.companyId, vesselId, scheduleItemId, notApplicable: true, createdBy: user.id, updatedBy: user.id },
      update: { notApplicable: true, updatedBy: user.id },
    });
  } else {
    await prisma.scheduleApplicability.deleteMany({
      where: { companyId: user.companyId, vesselId, scheduleItemId },
    });
  }

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "ScheduleApplicability",
    entityId: `${vesselId}:${scheduleItemId}`,
    summary: `Marked schedule item ${notApplicable ? "not applicable" : "applicable"} for ${vessel.name}`,
  });

  revalidatePath("/drills/matrix");
  return OK;
}
