import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Reads for the Departments admin.
 *
 * Like the access-levels list, this includes deactivated rows (deletedAt set)
 * so they can be reactivated. Ordered by side then active-first then name; the
 * page groups them into Ship / Shore. The user-assignment dropdown is a
 * separate, active-only query.
 */
export async function listDepartments(companyId: string) {
  return prisma.department.findMany({
    where: { companyId },
    orderBy: [{ side: "asc" }, { deletedAt: { sort: "asc", nulls: "first" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      side: true,
      description: true,
      isSystem: true,
      deletedAt: true,
      _count: { select: { users: true } },
    },
  });
}

export type DepartmentRow = Awaited<ReturnType<typeof listDepartments>>[number];

/** Assignable departments — active only — for the user create/edit dropdown. */
export async function listDepartmentOptions(companyId: string) {
  return prisma.department.findMany({
    where: { companyId, deletedAt: null },
    orderBy: [{ side: "asc" }, { name: "asc" }],
    select: { id: true, name: true, side: true },
  });
}
