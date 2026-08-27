"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { diffFields } from "@/lib/audit-diff";
import {
  ACCESS_LEVEL_NOT_FOUND,
  ACCESS_LEVEL_SYSTEM_LOCKED,
  accessLevelNameTaken,
  saveAccessLevelSchema,
  toggleAccessLevelSchema,
} from "./schema";
import { failFromZod, type ActionResult } from "@/features/shared/action-result";

export type { ActionResult };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/**
 * Create or edit one access level. Gated `access-level:manage`: defining the
 * levels every account is classified by is an Administrator-only office act.
 */
export async function saveAccessLevelAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("access-level:manage");

  const parsed = saveAccessLevelSchema.safeParse({
    accessLevelId: formData.get("accessLevelId") ?? undefined,
    name: formData.get("name"),
    rank: formData.get("rank"),
    description: formData.get("description") ?? undefined,
  });
  if (!parsed.success) return failFromZod(parsed.error);
  const d = parsed.data;

  const data = { name: d.name, rank: d.rank, description: d.description || null };

  try {
    if (d.accessLevelId) {
      // Only an ACTIVE level is editable — a deactivated one is reactivated,
      // not edited, so the row action offers Reactivate rather than a form.
      const existing = await prisma.accessLevel.findFirst({
        where: { id: d.accessLevelId, companyId: user.companyId, deletedAt: null },
      });
      if (!existing) return fail(ACCESS_LEVEL_NOT_FOUND);

      const updated = await prisma.accessLevel.update({
        where: { id: existing.id },
        data: { ...data, updatedBy: user.id },
      });
      const changes = diffFields(existing, data);
      await writeAudit({
        actor: user,
        action: "UPDATE",
        entityType: "AccessLevel",
        entityId: updated.id,
        summary:
          Object.keys(changes).length > 0
            ? `Updated access level ${updated.name}`
            : `Re-saved access level ${updated.name} with no changes`,
        metadata: { changes },
      });
    } else {
      const created = await prisma.accessLevel.create({
        data: { companyId: user.companyId, ...data, createdBy: user.id, updatedBy: user.id },
      });
      await writeAudit({
        actor: user,
        action: "CREATE",
        entityType: "AccessLevel",
        entityId: created.id,
        summary: `Added access level ${created.name} (rank ${created.rank})`,
      });
    }
  } catch (err) {
    if (isUniqueViolation(err)) return fail(accessLevelNameTaken(d.name));
    throw err;
  }

  revalidatePath("/settings/access-levels");
  return OK;
}

/**
 * Deactivates (soft-deletes) or reactivates a level. A system level can't be
 * deactivated — `isSystem` is the "can't be deleted" guard — but it can always
 * be reactivated. Deactivating hides it from the user dropdown; accounts
 * already on it keep it until reassigned.
 */
export async function toggleAccessLevelActiveAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("access-level:manage");

  const parsed = toggleAccessLevelSchema.safeParse({
    accessLevelId: formData.get("accessLevelId"),
  });
  if (!parsed.success) return failFromZod(parsed.error);

  // No deletedAt filter: a deactivated row must still be findable to reactivate.
  const existing = await prisma.accessLevel.findFirst({
    where: { id: parsed.data.accessLevelId, companyId: user.companyId },
    select: { id: true, name: true, isSystem: true, deletedAt: true },
  });
  if (!existing) return fail(ACCESS_LEVEL_NOT_FOUND);

  const deactivating = existing.deletedAt === null;
  if (deactivating && existing.isSystem) return fail(ACCESS_LEVEL_SYSTEM_LOCKED);

  await prisma.accessLevel.update({
    where: { id: existing.id },
    data: {
      deletedAt: deactivating ? new Date() : null,
      deletedBy: deactivating ? user.id : null,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "AccessLevel",
    entityId: existing.id,
    summary: `${deactivating ? "Deactivated" : "Reactivated"} access level ${existing.name}`,
  });

  revalidatePath("/settings/access-levels");
  return OK;
}
