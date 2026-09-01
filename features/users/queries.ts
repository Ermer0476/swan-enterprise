import "server-only";
import { prisma } from "@/lib/prisma";
import { paginationArgs, paginate, type Paginated } from "@/lib/pagination";
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

/** The list's `where`, shared by the paginated screen read and the full-list
 *  export so the two can never diverge on what a filter means. */
function usersWhere(companyId: string, filters: UserFilters) {
  return {
    companyId,
    deletedAt: null,
    ...(filters.active === undefined ? {} : { active: filters.active }),
    ...(filters.search
      ? {
          OR: [
            { fullName: { contains: filters.search, mode: "insensitive" as const } },
            { email: { contains: filters.search, mode: "insensitive" as const } },
            { rank: { contains: filters.search, mode: "insensitive" as const } },
            // E1 gave every masterlist employee an ID; searching by it is what
            // a crewing clerk reaches for first, so it belongs in the OR.
            { employeeId: { contains: filters.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
}

/** How many accounts a page of User Management shows. The client's request:
 *  20 rows, numbered navigation beneath the table. */
const USERS_PAGE_SIZE = 20;

/**
 * User Management's paginated screen read — 20 to a page, server-side
 * `skip`/`take`, so a company with hundreds of accounts never ships the whole
 * table into an RSC payload. `page` is clamped to the last page here, not in
 * the URL, so a stale or hand-typed `?page=999` lands on the last page of rows
 * rather than an empty table.
 */
export async function listUsers(
  companyId: string,
  filters: UserFilters = {},
  page = 1,
): Promise<Paginated<Awaited<ReturnType<typeof listAllUsers>>[number]>> {
  const where = usersWhere(companyId, filters);
  const total = await prisma.user.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / USERS_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const rows = await prisma.user.findMany({
    where,
    select: USER_SELECT,
    orderBy: [{ fullName: "asc" }],
    ...paginationArgs(safePage, USERS_PAGE_SIZE),
  });
  return paginate(rows, total, safePage, USERS_PAGE_SIZE);
}

/**
 * The whole filtered list, unpaginated — the export's read (features/users/
 * export.ts). The export must carry every matching account, not one screen of
 * them, and it reuses `USER_SELECT` so `passwordHash` stays structurally
 * unreachable there too.
 */
export async function listAllUsers(companyId: string, filters: UserFilters = {}) {
  return prisma.user.findMany({
    where: usersWhere(companyId, filters),
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
