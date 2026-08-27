"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { isReferenceListKey } from "@/lib/reference-registry";
import {
  addReferenceListItemSchema,
  updateReferenceListItemSchema,
  deleteReferenceListItemSchema,
} from "./schema";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

const SETTINGS_PATH = "/settings/reference-lists";

export async function addReferenceListItemAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("reference:manage");
  const parsed = addReferenceListItemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  if (!isReferenceListKey(d.listKey)) return fail("Unknown reference list.");

  const existing = await prisma.referenceListItem.findUnique({
    where: { companyId_listKey_value: { companyId: user.companyId, listKey: d.listKey, value: d.value } },
  });
  // A soft-deleted row still occupies the unique (companyId,listKey,value);
  // resurrect it rather than colliding.
  if (existing) {
    if (existing.deletedAt === null) return fail(`"${d.value}" already exists in this list.`);
    await prisma.referenceListItem.update({
      where: { id: existing.id },
      data: { label: d.label, sortOrder: d.sortOrder, active: true, deletedAt: null, deletedBy: null, updatedBy: user.id },
    });
    await writeAudit({
      actor: user,
      action: "UPDATE",
      entityType: "ReferenceListItem",
      entityId: existing.id,
      summary: `Restored reference option "${d.label}" (${d.value}) in ${d.listKey}`,
    });
    revalidatePath(SETTINGS_PATH);
    return OK;
  }

  const row = await prisma.referenceListItem.create({
    data: {
      companyId: user.companyId,
      listKey: d.listKey,
      value: d.value,
      label: d.label,
      sortOrder: d.sortOrder,
      isSystem: false,
      createdBy: user.id,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "ReferenceListItem",
    entityId: row.id,
    summary: `Added reference option "${d.label}" (${d.value}) to ${d.listKey}`,
  });

  revalidatePath(SETTINGS_PATH);
  return OK;
}

export async function updateReferenceListItemAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("reference:manage");
  const parsed = updateReferenceListItemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const existing = await prisma.referenceListItem.findFirst({
    where: { id: d.id, companyId: user.companyId, deletedAt: null },
  });
  if (!existing) return fail("Reference option not found");

  await prisma.referenceListItem.update({
    where: { id: d.id },
    data: { label: d.label, sortOrder: d.sortOrder, active: d.active, updatedBy: user.id },
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "ReferenceListItem",
    entityId: d.id,
    summary: `Updated reference option "${existing.value}" in ${existing.listKey}${existing.active !== d.active ? ` — ${d.active ? "activated" : "deactivated"}` : ""}`,
  });

  revalidatePath(SETTINGS_PATH);
  return OK;
}

/** Remove a non-system option outright; system (seeded) options are never hard
 * deleted — they are the registry's fallback parity, so a delete on one just
 * deactivates it (same effect the office gets from the active toggle). */
export async function deleteReferenceListItemAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("reference:manage");
  const parsed = deleteReferenceListItemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Invalid request");

  const existing = await prisma.referenceListItem.findFirst({
    where: { id: parsed.data.id, companyId: user.companyId, deletedAt: null },
  });
  if (!existing) return fail("Reference option not found");

  if (existing.isSystem) {
    await prisma.referenceListItem.update({
      where: { id: existing.id },
      data: { active: false, updatedBy: user.id },
    });
    await writeAudit({
      actor: user,
      action: "UPDATE",
      entityType: "ReferenceListItem",
      entityId: existing.id,
      summary: `Deactivated system reference option "${existing.value}" in ${existing.listKey}`,
    });
  } else {
    await prisma.referenceListItem.update({
      where: { id: existing.id },
      data: { deletedAt: new Date(), deletedBy: user.id, active: false },
    });
    await writeAudit({
      actor: user,
      action: "DELETE",
      entityType: "ReferenceListItem",
      entityId: existing.id,
      summary: `Deleted reference option "${existing.value}" from ${existing.listKey}`,
    });
  }

  revalidatePath(SETTINGS_PATH);
  return OK;
}
