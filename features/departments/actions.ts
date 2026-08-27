"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { diffFields } from "@/lib/audit-diff";
import {
  DEPARTMENT_HAS_USERS,
  DEPARTMENT_NOT_FOUND,
  DEPARTMENT_SYSTEM_LOCKED,
  departmentNameTaken,
  saveDepartmentSchema,
  toggleDepartmentSchema,
} from "./schema";
import { failFromZod, type ActionResult } from "@/features/shared/action-result";

export type { ActionResult };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/**
 * Create or edit one department. Gated `department:manage`. `side`
 * (ship/shore) is set here; the NAME is free data so the office can add
 * "Catering" as a ship department without a code change.
 */
export async function saveDepartmentAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("department:manage");

  const parsed = saveDepartmentSchema.safeParse({
    departmentId: formData.get("departmentId") ?? undefined,
    name: formData.get("name"),
    side: formData.get("side"),
    description: formData.get("description") ?? undefined,
  });
  if (!parsed.success) return failFromZod(parsed.error);
  const d = parsed.data;

  const data = { name: d.name, side: d.side, description: d.description || null };

  try {
    if (d.departmentId) {
      const existing = await prisma.department.findFirst({
        where: { id: d.departmentId, companyId: user.companyId, deletedAt: null },
      });
      if (!existing) return fail(DEPARTMENT_NOT_FOUND);

      const updated = await prisma.department.update({
        where: { id: existing.id },
        data: { ...data, updatedBy: user.id },
      });
      const changes = diffFields(existing, data);
      await writeAudit({
        actor: user,
        action: "UPDATE",
        entityType: "Department",
        entityId: updated.id,
        summary:
          Object.keys(changes).length > 0
            ? `Updated department ${updated.name}`
            : `Re-saved department ${updated.name} with no changes`,
        metadata: { changes },
      });
    } else {
      const created = await prisma.department.create({
        data: { companyId: user.companyId, ...data, createdBy: user.id, updatedBy: user.id },
      });
      await writeAudit({
        actor: user,
        action: "CREATE",
        entityType: "Department",
        entityId: created.id,
        summary: `Added ${created.side === "SHIP" ? "ship" : "shore"} department ${created.name}`,
      });
    }
  } catch (err) {
    if (isUniqueViolation(err)) return fail(departmentNameTaken(d.name));
    throw err;
  }

  revalidatePath("/settings/departments");
  return OK;
}

/**
 * Deactivates (soft-deletes) or reactivates a department. Deactivation is
 * refused for a system department, and for one that still has users assigned.
 * Reactivation carries no such guard.
 */
export async function toggleDepartmentActiveAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("department:manage");

  const parsed = toggleDepartmentSchema.safeParse({
    departmentId: formData.get("departmentId"),
  });
  if (!parsed.success) return failFromZod(parsed.error);

  const existing = await prisma.department.findFirst({
    where: { id: parsed.data.departmentId, companyId: user.companyId },
    select: {
      id: true,
      name: true,
      isSystem: true,
      deletedAt: true,
      _count: { select: { users: true } },
    },
  });
  if (!existing) return fail(DEPARTMENT_NOT_FOUND);

  const deactivating = existing.deletedAt === null;
  if (deactivating && existing.isSystem) return fail(DEPARTMENT_SYSTEM_LOCKED);
  // Count is against the new departmentRefId FK, not the legacy enum column —
  // a user "in" this department is one whose departmentRefId points here.
  if (deactivating && existing._count.users > 0) return fail(DEPARTMENT_HAS_USERS);

  await prisma.department.update({
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
    entityType: "Department",
    entityId: existing.id,
    summary: `${deactivating ? "Deactivated" : "Reactivated"} department ${existing.name}`,
  });

  revalidatePath("/settings/departments");
  return OK;
}
