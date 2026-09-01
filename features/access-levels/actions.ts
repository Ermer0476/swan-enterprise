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
  ACCESS_LEVEL_RANK_ABOVE,
  PERMISSION_NOT_IN_CEILING,
  accessLevelNameTaken,
  saveAccessLevelSchema,
  saveAccessLevelPermissionsSchema,
  toggleAccessLevelSchema,
} from "./schema";
import type { PermissionKey } from "@/lib/permissions";
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
 * Sets exactly which permissions an access level GRANTS (E3 matrix). Gated
 * `access-level:manage`. Two no-escalation guards, both mirrored by disabled
 * cells in the grid so the UI never offers what this rejects:
 *
 *  - RANK: an actor who has a level of their own may not edit a level ranked
 *    above it. An actor with no level is bounded only by the subset rule below.
 *  - CEILING: the submitted set must be a SUBSET of the actor's own effective
 *    permissions (roles ∪ own access level — already unioned onto
 *    `actor.permissions` by getCurrentUser). You can't grant what you don't
 *    hold; with no level of your own, that ceiling is just your role permissions.
 *
 * The replace is CEILING-SCOPED: it adds submitted keys and removes only the
 * keys the actor controls (within their ceiling) that were unchecked. Keys
 * already on the level that lie OUTSIDE the actor's ceiling are PRESERVED — the
 * grid shows those disabled-but-checked, and browsers don't submit disabled
 * inputs, so a naive "match the submission exactly" would silently drop a grant
 * the actor can't even see and had no intent to touch.
 */
export async function saveAccessLevelPermissionsAction(
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requirePermission("access-level:manage");

  const parsed = saveAccessLevelPermissionsSchema.safeParse({
    accessLevelId: formData.get("accessLevelId"),
    permissionKeys: formData.getAll("permissionKeys"),
  });
  if (!parsed.success) return failFromZod(parsed.error);
  const submitted = parsed.data.permissionKeys as PermissionKey[];

  // Target level, own company. A deactivated level is still editable here — same
  // doctrine as resolveAccessLevel (retiring doesn't unassign accounts on it).
  const target = await prisma.accessLevel.findFirst({
    where: { id: parsed.data.accessLevelId, companyId: actor.companyId },
    select: { id: true, name: true, rank: true },
  });
  if (!target) return fail(ACCESS_LEVEL_NOT_FOUND);

  // Rank guard — only bites when the actor HAS a level of their own.
  if (actor.accessLevelRank !== null && target.rank > actor.accessLevelRank) {
    return fail(ACCESS_LEVEL_RANK_ABOVE);
  }

  // Ceiling (subset) guard.
  const ceiling = actor.permissions;
  if (submitted.some((k) => !ceiling.has(k))) return fail(PERMISSION_NOT_IN_CEILING);

  // Current grants on this level (keys + ids), and the submitted keys resolved to
  // ids. Every submitted key passed the subset check, so it is a real permission
  // the actor holds and therefore exists in the catalog.
  const [submittedPerms, current] = await Promise.all([
    prisma.permission.findMany({
      where: { key: { in: submitted } },
      select: { id: true, key: true },
    }),
    prisma.accessLevelPermission.findMany({
      where: { accessLevelId: target.id },
      select: { permissionId: true, permission: { select: { key: true } } },
    }),
  ]);
  const idByKey = new Map(submittedPerms.map((p) => [p.key, p.id] as const));
  const currentKeys = new Set(current.map((c) => c.permission.key));
  const currentIdByKey = new Map(current.map((c) => [c.permission.key, c.permissionId] as const));
  const submittedSet = new Set<string>(submitted);

  const addedKeys = submitted.filter((k) => !currentKeys.has(k));
  // Remove only keys within the actor's ceiling that were unchecked; preserve
  // out-of-ceiling grants the actor can't see or touch.
  const removedKeys = [...currentKeys].filter(
    (k) => ceiling.has(k as PermissionKey) && !submittedSet.has(k),
  );

  if (addedKeys.length === 0 && removedKeys.length === 0) return OK;

  const addData = addedKeys.map((k) => ({
    accessLevelId: target.id,
    permissionId: idByKey.get(k) as string,
  }));
  const removeIds = removedKeys.map((k) => currentIdByKey.get(k) as string);

  await prisma.$transaction(async (tx) => {
    if (removeIds.length > 0) {
      await tx.accessLevelPermission.deleteMany({
        where: { accessLevelId: target.id, permissionId: { in: removeIds } },
      });
    }
    if (addData.length > 0) {
      await tx.accessLevelPermission.createMany({ data: addData, skipDuplicates: true });
    }
  });

  await writeAudit({
    actor,
    action: "UPDATE",
    entityType: "AccessLevel",
    entityId: target.id,
    summary: `Updated permissions for access level ${target.name} (+${addedKeys.length} / -${removedKeys.length})`,
    metadata: { added: addedKeys, removed: removedKeys },
  });

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
