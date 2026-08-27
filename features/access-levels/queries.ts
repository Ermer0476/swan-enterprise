import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Reads for the Access Levels admin.
 *
 * The management list shows deactivated levels too (deletedAt set) so they can
 * be reactivated — a "deactivate" that could never be undone would just be a
 * delete. Active levels sort first, then by rank descending (superadmin on
 * top). The user-assignment dropdown is a SEPARATE query that hides
 * deactivated levels: you may not newly assign one that has been retired.
 */
export async function listAccessLevels(companyId: string) {
  return prisma.accessLevel.findMany({
    where: { companyId },
    orderBy: [{ deletedAt: { sort: "asc", nulls: "first" } }, { rank: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      rank: true,
      description: true,
      isSystem: true,
      deletedAt: true,
      _count: { select: { users: true } },
    },
  });
}

export type AccessLevelRow = Awaited<ReturnType<typeof listAccessLevels>>[number];

/** Assignable levels — active only — for the user create/edit dropdown. */
export async function listAccessLevelOptions(companyId: string) {
  return prisma.accessLevel.findMany({
    where: { companyId, deletedAt: null },
    orderBy: [{ rank: "desc" }, { name: "asc" }],
    select: { id: true, name: true, rank: true },
  });
}
