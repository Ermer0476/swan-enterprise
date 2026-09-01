import "server-only";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";

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

/**
 * The E3 permission-matrix columns: each ACTIVE level with the set of permission
 * KEYS it currently grants. Active-only (deletedAt: null) so the columns are the
 * live, assignable vocabulary — a retired level isn't shown to be tuned. Highest
 * rank first so the grid reads left-to-right most→least privileged.
 */
export async function listAccessLevelPermissionMatrix(companyId: string) {
  const levels = await prisma.accessLevel.findMany({
    where: { companyId, deletedAt: null },
    orderBy: [{ rank: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      rank: true,
      permissions: { select: { permission: { select: { key: true } } } },
    },
  });
  return levels.map((l) => ({
    id: l.id,
    name: l.name,
    rank: l.rank,
    keys: l.permissions.map((p) => p.permission.key),
  }));
}

export type AccessLevelMatrixColumn = Awaited<
  ReturnType<typeof listAccessLevelPermissionMatrix>
>[number];

/**
 * The actor's own ceiling for the grid: their rank (null when they have no level
 * of their own) and their effective permission set — the union of role and own
 * access-level keys that getCurrentUser already folded onto `permissions`. The
 * grid disables the columns ranked above `rank` and the rows whose key is not in
 * `keys`, matching the server's no-escalation refusals exactly.
 */
export function actorCeiling(user: SessionUser): { rank: number | null; keys: string[] } {
  return { rank: user.accessLevelRank, keys: [...user.permissions] };
}
