import "server-only";
import { prisma } from "@/lib/prisma";
import type { PermissionKey } from "@/lib/permissions";

/**
 * Reads for User Management.
 *
 * Every select in this file is explicit, and none of them names
 * `passwordHash`. That is the point: a `select` that listed the whole User
 * row would ship the bcrypt hash of every account into an RSC payload the
 * browser can read. Add fields here one at a time, never with a bare
 * `include`.
 */

const USER_SELECT = {
  id: true,
  fullName: true,
  email: true,
  department: true,
  rank: true,
  employeeId: true,
  crewId: true,
  // ── Employee Masterlist (E1). Added one at a time to the explicit select —
  //    this stays a `select`, never an `include`, so passwordHash can never
  //    ride along into an RSC payload. ──
  lastName: true,
  firstName: true,
  middleName: true,
  initials: true,
  gender: true,
  employmentStatus: true,
  designation: true,
  birthDate: true,
  dateHired: true,
  officialAddress: true,
  tin: true,
  sss: true,
  hdmf: true,
  philHealth: true,
  active: true,
  lastLoginAt: true,
  createdAt: true,
  vesselId: true,
  vessel: { select: { id: true, name: true } },
  accessLevelId: true,
  accessLevel: { select: { id: true, name: true } },
  departmentRefId: true,
  departmentRef: { select: { id: true, name: true, side: true } },
  roles: { select: { role: { select: { id: true, name: true } } } },
} as const;

export type UserFilters = { search?: string; active?: boolean };

export async function listUsers(companyId: string, filters: UserFilters = {}) {
  return prisma.user.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(filters.active === undefined ? {} : { active: filters.active }),
      ...(filters.search
        ? {
            OR: [
              { fullName: { contains: filters.search, mode: "insensitive" as const } },
              { email: { contains: filters.search, mode: "insensitive" as const } },
              { rank: { contains: filters.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    select: USER_SELECT,
    orderBy: [{ fullName: "asc" }],
  });
}

/** One user, scoped to the caller's company — a foreign id reads as absent. */
export async function getUser(companyId: string, id: string) {
  return prisma.user.findFirst({
    where: { id, companyId, deletedAt: null },
    select: USER_SELECT,
  });
}

/** Assignable "system accesses" — this company's roles only. */
export async function listRoleOptions(companyId: string) {
  return prisma.role.findMany({
    where: { companyId },
    select: { id: true, name: true, description: true },
    orderBy: { name: "asc" },
  });
}

/** Assignable "vessel accesses" — this company's live vessels only. */
export async function listVesselOptions(companyId: string) {
  return prisma.vessel.findMany({
    where: { companyId, deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

// ─── The "one active administrator" floor ───────────────────────────────────
//
// A company that loses its last active administrator cannot be repaired from
// the UI — nobody left can reach User Management to put one back. So it is an
// invariant, not a warning.
//
// "Administrator" is defined by permission, not by the role's name: whoever
// can manage users can re-grant every other permission, so `admin:manage-users`
// is the capability that must never go extinct. Defining it this way also
// survives a renamed or a hand-made role.

/** The permission whose last active holder may not be removed. */
export const ADMIN_FLOOR_PERMISSION: PermissionKey = "admin:manage-users";

/** Ids of this company's roles that confer administrator status. */
export async function adminRoleIds(companyId: string): Promise<Set<string>> {
  const roles = await prisma.role.findMany({
    where: {
      companyId,
      permissions: { some: { permission: { key: ADMIN_FLOOR_PERMISSION } } },
    },
    select: { id: true },
  });
  return new Set(roles.map((r) => r.id));
}

/**
 * The "is an active administrator of this company" predicate, as a `where`
 * clause rather than a finished count, so the write actions can run it on
 * their own transaction client — the floor is asserted *inside* the
 * transaction that changes it, and a pre-computed number would be stale by
 * the time it mattered. One definition, used everywhere it is asked.
 */
export function activeAdminWhere(companyId: string) {
  return {
    companyId,
    active: true,
    deletedAt: null,
    roles: {
      some: {
        role: {
          permissions: { some: { permission: { key: ADMIN_FLOOR_PERMISSION } } },
        },
      },
    },
  };
}

/**
 * The crew (Seafarer) record linked to a login, if any — for the read-only
 * "Crew record" line on the user detail page. Company-scoped. Selects only the
 * seafarer's id, crew code and name parts: NO sensitive tier (§3.1) is read
 * here, and there is no `include` that would pull a password or a masterlist
 * field. A foreign or deleted user reads as no link.
 */
export async function getUserCrewRecord(companyId: string, userId: string) {
  const row = await prisma.user.findFirst({
    where: { id: userId, companyId, deletedAt: null },
    select: {
      seafarer: {
        select: {
          id: true,
          crewCode: true,
          lastName: true,
          firstName: true,
          middleName: true,
          suffix: true,
        },
      },
    },
  });
  return row?.seafarer ?? null;
}
