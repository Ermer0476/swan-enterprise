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

// Administrator-only (schedule:manage) — stricter than the N/A toggle
// above, since this is a fixed SMS schedule fact shared by the whole
// fleet, not a per-vessel one. No office role other than Administrator
// should be able to change it, let alone a vessel.
export async function updateScheduleItemFrequencyAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("schedule:manage");
  const scheduleItemId = String(formData.get("scheduleItemId") ?? "");
  const frequencyLabel = String(formData.get("frequencyLabel") ?? "").trim();
  const frequencyDaysRaw = String(formData.get("frequencyDays") ?? "").trim();
  if (!scheduleItemId) return fail("Missing item");

  const item = await prisma.scheduleItem.findFirst({
    where: { id: scheduleItemId, companyId: user.companyId, deletedAt: null },
  });
  if (!item) return fail("Schedule item not found");

  // Blank days = irregular item ("as required/applicable") — never flagged
  // overdue, matching the existing frequencyDays-null convention.
  let frequencyDays: number | null = null;
  if (frequencyDaysRaw) {
    const parsed = Number(frequencyDaysRaw);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return fail("Frequency (days) must be a positive whole number");
    }
    frequencyDays = parsed;
  }

  await prisma.scheduleItem.update({
    where: { id: item.id },
    data: { frequencyLabel: frequencyLabel || null, frequencyDays },
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "ScheduleItem",
    entityId: item.id,
    summary: `Updated frequency for ${item.name} — ${frequencyLabel || "no fixed frequency"}`,
  });

  revalidatePath("/drills/matrix");
  return OK;
}
