"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import {
  createScheduleItemSchema,
  updateScheduleItemSchema,
  cloneFlagScheduleSchema,
} from "./schema";
import { listScheduleItems } from "./queries";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

// Blank days = irregular item ("as required/applicable") — never flagged
// overdue, matching the existing frequencyDays-null convention.
function parseFrequencyDays(raw: string): { ok: true; value: number | null } | { ok: false; error: string } {
  if (!raw) return { ok: true, value: null };
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { ok: false, error: "Frequency (days) must be a positive whole number" };
  }
  return { ok: true, value: parsed };
}

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

// Administrator-only (schedule:manage) — full CRUD for the Flag Drill
// Schedule admin page. Separate from updateScheduleItemFrequencyAction
// above (which stays as the matrix's own inline frequency-only edit).

export async function createScheduleItemAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("schedule:manage");
  const parsed = createScheduleItemSchema.safeParse({
    kind: formData.get("kind"),
    flag: formData.get("flag"),
    category: formData.get("category"),
    itemNo: formData.get("itemNo"),
    name: formData.get("name"),
    smsReference: formData.get("smsReference"),
    frequencyLabel: formData.get("frequencyLabel"),
    frequencyDays: formData.get("frequencyDays"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const days = parseFrequencyDays(d.frequencyDays || "");
  if (!days.ok) return fail(days.error);

  const flag = d.flag || "";
  const existing = await listScheduleItems(user.companyId, d.kind, flag);
  const sortOrder = existing.reduce((max, i) => Math.max(max, i.sortOrder), -1) + 1;

  const item = await prisma.scheduleItem.create({
    data: {
      companyId: user.companyId,
      kind: d.kind,
      flag,
      category: d.category || null,
      itemNo: d.itemNo || null,
      name: d.name,
      smsReference: d.smsReference || null,
      frequencyLabel: d.frequencyLabel || null,
      frequencyDays: days.value,
      sortOrder,
    },
  });

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "ScheduleItem",
    entityId: item.id,
    summary: `Added ${flag || "default"} ${d.kind.toLowerCase()} item — ${item.name}`,
  });

  revalidatePath("/settings/flag-drill-schedules");
  revalidatePath("/drills/matrix");
  return OK;
}

export async function updateScheduleItemAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("schedule:manage");
  const id = String(formData.get("id") ?? "");
  const parsed = updateScheduleItemSchema.safeParse({
    id,
    kind: formData.get("kind"),
    flag: formData.get("flag"),
    category: formData.get("category"),
    itemNo: formData.get("itemNo"),
    name: formData.get("name"),
    smsReference: formData.get("smsReference"),
    frequencyLabel: formData.get("frequencyLabel"),
    frequencyDays: formData.get("frequencyDays"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const item = await prisma.scheduleItem.findFirst({
    where: { id: d.id, companyId: user.companyId, deletedAt: null },
  });
  if (!item) return fail("Schedule item not found");

  const days = parseFrequencyDays(d.frequencyDays || "");
  if (!days.ok) return fail(days.error);

  await prisma.scheduleItem.update({
    where: { id: item.id },
    data: {
      category: d.category || null,
      itemNo: d.itemNo || null,
      name: d.name,
      smsReference: d.smsReference || null,
      frequencyLabel: d.frequencyLabel || null,
      frequencyDays: days.value,
    },
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "ScheduleItem",
    entityId: item.id,
    summary: `Edited ${item.flag || "default"} ${item.kind.toLowerCase()} item — ${d.name}`,
  });

  revalidatePath("/settings/flag-drill-schedules");
  revalidatePath("/drills/matrix");
  return OK;
}

export async function deleteScheduleItemAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("schedule:manage");
  const id = String(formData.get("id") ?? "");
  const item = await prisma.scheduleItem.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!item) return fail("Schedule item not found");

  await prisma.scheduleItem.update({
    where: { id: item.id },
    data: { deletedAt: new Date(), active: false },
  });

  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "ScheduleItem",
    entityId: item.id,
    summary: `Removed ${item.flag || "default"} ${item.kind.toLowerCase()} item — ${item.name}`,
  });

  revalidatePath("/settings/flag-drill-schedules");
  revalidatePath("/drills/matrix");
  return OK;
}

/** Bootstraps a new flag's set by copying every item from another set
 * (usually the default) — a starting point the office then tweaks
 * (mainly frequencies) rather than typing 50+ items from scratch. Copies
 * as brand-new rows; editing/deleting the copies never touches the source. */
export async function cloneFlagScheduleAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("schedule:manage");
  const parsed = cloneFlagScheduleSchema.safeParse({
    kind: formData.get("kind"),
    sourceFlag: formData.get("sourceFlag"),
    targetFlag: formData.get("targetFlag"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;
  const sourceFlag = d.sourceFlag || "";
  if (sourceFlag === d.targetFlag) return fail("Source and target flag must be different");

  const sourceItems = await listScheduleItems(user.companyId, d.kind, sourceFlag);
  if (sourceItems.length === 0) return fail("The source set has no items to copy");

  const existingTarget = await listScheduleItems(user.companyId, d.kind, d.targetFlag);
  if (existingTarget.length > 0) {
    return fail(`${d.targetFlag} already has its own ${d.kind.toLowerCase()} set — delete it first to re-clone`);
  }

  await prisma.scheduleItem.createMany({
    data: sourceItems.map((i) => ({
      companyId: user.companyId,
      kind: i.kind,
      flag: d.targetFlag,
      category: i.category,
      itemNo: i.itemNo,
      name: i.name,
      smsReference: i.smsReference,
      frequencyLabel: i.frequencyLabel,
      frequencyDays: i.frequencyDays,
      sortOrder: i.sortOrder,
    })),
  });

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "ScheduleItem",
    entityId: d.targetFlag,
    summary: `Cloned ${sourceItems.length} ${d.kind.toLowerCase()} item(s) from ${sourceFlag || "default"} to ${d.targetFlag}`,
  });

  revalidatePath("/settings/flag-drill-schedules");
  return OK;
}
