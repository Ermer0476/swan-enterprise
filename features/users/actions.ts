"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { hashPassword } from "@/lib/auth";
import { activeAdminWhere, adminRoleIds } from "./queries";
import {
  ACCESS_LEVEL_UNAVAILABLE,
  createUserSchema,
  CREW_ID_TAKEN,
  DEPARTMENT_UNAVAILABLE,
  EMAIL_TAKEN,
  EMPLOYEE_ID_TAKEN,
  LAST_ADMIN,
  ROLE_NOT_FOUND,
  SELF_DEACTIVATE,
  SELF_DEPARTMENT_CHANGE,
  SELF_ROLE_CHANGE,
  setUserActiveSchema,
  signOutEverywhereSchema,
  updateUserSchema,
  USER_NOT_FOUND,
  VESSEL_UNAVAILABLE,
} from "./schema";
import { failFromZod, type ActionResult } from "@/features/shared/action-result";

// A "use server" module may only export async functions, so the refusal
// messages live in ./schema.ts alongside the rest of this feature's shared
// constants — the ActionResult re-export below is a type, which is allowed.
export type { ActionResult };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

/**
 * User management is an office-only function — the same gate the reference
 * expressed as assertShoreOnly(), inlined here against the legacy department
 * signal (department === "SHIPBOARD"), which is what lib/user-access.ts still
 * treats as shipboard. A shipboard login administering accounts is out of
 * scope for this build.
 */
const SHORE_ONLY = "User management is available from an office account only.";

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Thrown inside a write transaction when the change would leave the company
 * with no active administrator. Rolling the transaction back is the point:
 * the floor is asserted against what the write actually produced, not
 * predicted before it, so nothing can slip between the check and the write.
 */
class AdminFloorError extends Error {}

/**
 * Checkbox groups post one entry per ticked box. Deduplicated because the
 * same role posted twice would otherwise fail the "did every id resolve?"
 * count below and collide on UserRole's composite primary key.
 */
function roleIdsFrom(formData: FormData): string[] {
  return [
    ...new Set(
      formData
        .getAll("roleIds")
        .map((v) => String(v).trim())
        .filter(Boolean),
    ),
  ];
}

/**
 * Resolves submitted role ids against the caller's own company. A role id is
 * addressable by anyone who can post this form, so an unchecked one would let
 * another company's role (with another company's permissions) be pinned onto
 * this company's user. Returns null if any id is foreign or unknown; the
 * caller must write back the resolved ids, never the raw input.
 */
async function resolveRoles(
  companyId: string,
  roleIds: string[],
): Promise<{ id: string; name: string }[] | null> {
  const roles = await prisma.role.findMany({
    where: { id: { in: roleIds }, companyId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return roles.length === roleIds.length ? roles : null;
}

/**
 * Resolves an optional vessel id against the caller's own company — inlined in
 * place of the reference's lib/vessel-ownership helper. A vessel from another
 * company, or an unknown/retired one, must never be pinnable onto this
 * company's user. Blank is legitimate (an office account) and resolves to null.
 */
type VesselResult =
  | { ok: true; vessel: { id: string; name: string } | null }
  | { ok: false };

async function resolveVessel(companyId: string, id: string): Promise<VesselResult> {
  if (!id) return { ok: true, vessel: null };
  const vessel = await prisma.vessel.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, name: true },
  });
  return vessel ? { ok: true, vessel } : { ok: false };
}

/**
 * Resolves an optional access-level / department id against the caller's own
 * company, the same way resolveRoles and resolveVessel guard those: an id from
 * another company, or an unknown one, must never be pinnable onto this
 * company's user. Blank is legitimate (unassigned) and resolves to `null`.
 *
 * Deactivated (soft-deleted) rows are DELIBERATELY still resolvable. Retiring a
 * level/department doesn't unassign the accounts already on it, so a re-save of
 * such an account must keep its value rather than have this reject it — the
 * edit page therefore shows the current assignment even when it is retired
 * (see the option-merge there). New assignments are kept off retired rows at
 * the UI layer instead: listAccessLevelOptions / listDepartmentOptions only
 * offer active ones. Assigning a retired-but-owned value is a legitimate state,
 * not a privilege boundary, so company scope is the only check that belongs here.
 */
type RefResult = { ok: true; value: { id: string; name: string } | null } | { ok: false };

async function resolveAccessLevel(companyId: string, id: string): Promise<RefResult> {
  if (!id) return { ok: true, value: null };
  const row = await prisma.accessLevel.findFirst({
    where: { id, companyId },
    select: { id: true, name: true },
  });
  return row ? { ok: true, value: row } : { ok: false };
}

async function resolveDepartmentRef(companyId: string, id: string): Promise<RefResult> {
  if (!id) return { ok: true, value: null };
  const row = await prisma.department.findFirst({
    where: { id, companyId },
    select: { id: true, name: true },
  });
  return row ? { ok: true, value: row } : { ok: false };
}

/**
 * employeeId is company-scoped and live-only: uniqueness is enforced in-action
 * (not as an @@unique constraint) so a soft-deleted account never blocks a
 * reused id, and two companies can each hold the same id — same reason as
 * Seafarer.crewCode.
 */
async function employeeIdTaken(
  companyId: string,
  employeeId: string,
  exceptUserId?: string,
): Promise<boolean> {
  if (!employeeId) return false;
  const hit = await prisma.user.findFirst({
    where: {
      companyId,
      deletedAt: null,
      employeeId,
      ...(exceptUserId ? { id: { not: exceptUserId } } : {}),
    },
    select: { id: true },
  });
  return hit !== null;
}

/**
 * crewId is company-scoped and live-only, enforced exactly like employeeId
 * above (in-action, not @@unique) so a soft-deleted account never blocks a
 * reused id — same reason as Seafarer.crewCode. Blank means non-seafarer and is
 * never "taken".
 */
async function crewIdTaken(
  companyId: string,
  crewId: string,
  exceptUserId?: string,
): Promise<boolean> {
  if (!crewId) return false;
  const hit = await prisma.user.findFirst({
    where: {
      companyId,
      deletedAt: null,
      crewId,
      ...(exceptUserId ? { id: { not: exceptUserId } } : {}),
    },
    select: { id: true },
  });
  return hit !== null;
}

/**
 * User.email is unique across the whole table, not per company, so this is a
 * global check. The message deliberately says nothing about who holds the
 * address — including whether they belong to another company, or to a
 * soft-deleted account that still owns the row.
 */
async function emailTaken(email: string, exceptUserId?: string): Promise<boolean> {
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  return existing !== null && existing.id !== exceptUserId;
}

/** Prisma's unique-constraint violation — the race the pre-check can't win. */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "P2002"
  );
}

// ─── Create ─────────────────────────────────────────────────────────────────

export async function createUserAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requirePermission("admin:manage-users");
  if (actor.department === "SHIPBOARD") return fail(SHORE_ONLY);
  const parsed = createUserSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    department: formData.get("department"),
    rank: formData.get("rank"),
    employeeId: formData.get("employeeId"),
    crewId: formData.get("crewId"),
    vesselId: formData.get("vesselId"),
    accessLevelId: formData.get("accessLevelId"),
    departmentRefId: formData.get("departmentRefId"),
    roleIds: roleIdsFrom(formData),
    password: formData.get("password"),
  });
  if (!parsed.success) return failFromZod(parsed.error);
  const d = parsed.data;

  const vessel = await resolveVessel(actor.companyId, d.vesselId || "");
  if (!vessel.ok) return fail(VESSEL_UNAVAILABLE);

  const roles = await resolveRoles(actor.companyId, d.roleIds);
  if (!roles) return fail(ROLE_NOT_FOUND);

  const accessLevel = await resolveAccessLevel(actor.companyId, d.accessLevelId || "");
  if (!accessLevel.ok) return fail(ACCESS_LEVEL_UNAVAILABLE);
  const departmentRef = await resolveDepartmentRef(actor.companyId, d.departmentRefId || "");
  if (!departmentRef.ok) return fail(DEPARTMENT_UNAVAILABLE);

  if (await emailTaken(d.email)) return fail(EMAIL_TAKEN);
  if (await employeeIdTaken(actor.companyId, (d.employeeId || "").trim()))
    return fail(EMPLOYEE_ID_TAKEN);
  if (await crewIdTaken(actor.companyId, (d.crewId || "").trim()))
    return fail(CREW_ID_TAKEN);

  // The only place a plaintext password exists is this local. It is never
  // stored, returned, audited or logged.
  const passwordHash = await hashPassword(d.password);

  let created: { id: string; fullName: string; email: string };
  try {
    created = await prisma.user.create({
      data: {
        companyId: actor.companyId,
        fullName: d.fullName,
        email: d.email,
        passwordHash,
        department: d.department,
        rank: d.rank || null,
        employeeId: d.employeeId?.trim() || null,
        crewId: d.crewId?.trim() || null,
        vesselId: vessel.vessel?.id ?? null,
        accessLevelId: accessLevel.value?.id ?? null,
        departmentRefId: departmentRef.value?.id ?? null,
        active: true,
        // The password above is admin-issued and one-time: the new account is
        // forced to /change-password on its first authenticated request and
        // can reach nothing else until it sets its own. This is the join with
        // the Phase-4 first-login flow. Cleared there.
        mustChangePassword: true,
        createdBy: actor.id,
        updatedBy: actor.id,
        // Nested so the account and its accesses land in one statement — a
        // half-created user with no roles can sign in and see nothing.
        roles: { create: roles.map((r) => ({ roleId: r.id })) },
      },
      select: { id: true, fullName: true, email: true },
    });
  } catch (err) {
    if (isUniqueViolation(err)) return fail(EMAIL_TAKEN);
    throw err;
  }

  await writeAudit({
    actor,
    action: "CREATE",
    entityType: "User",
    entityId: created.id,
    summary: `${actor.fullName} created user ${created.fullName} (${created.email}) with ${roles.map((r) => r.name).join(", ")}`,
    metadata: {
      email: created.email,
      department: d.department,
      employeeId: d.employeeId?.trim() || null,
      crewId: d.crewId?.trim() || null,
      roles: roles.map((r) => r.name),
      vessel: vessel.vessel?.name ?? null,
      accessLevel: accessLevel.value?.name ?? null,
      departmentRef: departmentRef.value?.name ?? null,
    },
  });

  revalidatePath("/settings/users");
  redirect(`/settings/users/${created.id}`);
}

// ─── Update ─────────────────────────────────────────────────────────────────

export async function updateUserAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requirePermission("admin:manage-users");
  if (actor.department === "SHIPBOARD") return fail(SHORE_ONLY);
  const parsed = updateUserSchema.safeParse({
    userId: formData.get("userId"),
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    department: formData.get("department"),
    rank: formData.get("rank"),
    employeeId: formData.get("employeeId"),
    crewId: formData.get("crewId"),
    vesselId: formData.get("vesselId"),
    accessLevelId: formData.get("accessLevelId"),
    departmentRefId: formData.get("departmentRefId"),
    roleIds: roleIdsFrom(formData),
    password: formData.get("password"),
  });
  if (!parsed.success) return failFromZod(parsed.error);
  const d = parsed.data;

  const target = await prisma.user.findFirst({
    where: { id: d.userId, companyId: actor.companyId, deletedAt: null },
    select: {
      id: true,
      fullName: true,
      email: true,
      active: true,
      department: true,
      roles: { select: { roleId: true, role: { select: { name: true } } } },
    },
  });
  if (!target) return fail(USER_NOT_FOUND);

  const vessel = await resolveVessel(actor.companyId, d.vesselId || "");
  if (!vessel.ok) return fail(VESSEL_UNAVAILABLE);

  const roles = await resolveRoles(actor.companyId, d.roleIds);
  if (!roles) return fail(ROLE_NOT_FOUND);

  const accessLevel = await resolveAccessLevel(actor.companyId, d.accessLevelId || "");
  if (!accessLevel.ok) return fail(ACCESS_LEVEL_UNAVAILABLE);
  const departmentRef = await resolveDepartmentRef(actor.companyId, d.departmentRefId || "");
  if (!departmentRef.ok) return fail(DEPARTMENT_UNAVAILABLE);

  const currentRoleIds = new Set(target.roles.map((r) => r.roleId));
  const nextRoleIds = roles.map((r) => r.id);
  const rolesChanged =
    currentRoleIds.size !== nextRoleIds.length ||
    nextRoleIds.some((id) => !currentRoleIds.has(id));

  // An administrator editing their own account may fix their name or reset
  // their own password, but may not touch their own accesses: that is the
  // path by which one account quietly grants itself more than it was given,
  // with nobody else in the loop.
  if (target.id === actor.id && rolesChanged) return fail(SELF_ROLE_CHANGE);

  // Department is not a label. Workflow steps can name an approving
  // department (WorkflowStep.approverDept), so moving your own account into
  // another one widens your own approval authority — the same escalation
  // SELF_ROLE_CHANGE blocks, reached by a quieter route. It is also the legacy
  // security signal (SHIPBOARD ⇒ vessel scope, lib/user-access.ts).
  if (target.id === actor.id && d.department !== target.department) {
    return fail(SELF_DEPARTMENT_CHANGE);
  }

  const adminIds = await adminRoleIds(actor.companyId);
  const wasAdmin = [...currentRoleIds].some((id) => adminIds.has(id));
  // Only an *active* administrator counts toward the floor, so demoting an
  // already-deactivated one is always allowed. The floor itself is asserted
  // inside the write transaction below, not here.
  const guardAdminFloor = target.active && wasAdmin && rolesChanged;

  if (await emailTaken(d.email, target.id)) return fail(EMAIL_TAKEN);
  if (await employeeIdTaken(actor.companyId, (d.employeeId || "").trim(), target.id))
    return fail(EMPLOYEE_ID_TAKEN);
  if (await crewIdTaken(actor.companyId, (d.crewId || "").trim(), target.id))
    return fail(CREW_ID_TAKEN);

  const passwordHash = d.password ? await hashPassword(d.password) : null;

  try {
    await prisma.$transaction(async (tx) => {
      // nextRoleIds is never empty (the schema requires one), so this can't
      // degenerate into "delete every role".
      await tx.userRole.deleteMany({
        where: { userId: target.id, roleId: { notIn: nextRoleIds } },
      });
      await tx.userRole.createMany({
        data: nextRoleIds.map((roleId) => ({ userId: target.id, roleId })),
        skipDuplicates: true,
      });
      await tx.user.update({
        where: { id: target.id },
        data: {
          fullName: d.fullName,
          email: d.email,
          department: d.department,
          rank: d.rank || null,
          employeeId: d.employeeId?.trim() || null,
          crewId: d.crewId?.trim() || null,
          vesselId: vessel.vessel?.id ?? null,
          accessLevelId: accessLevel.value?.id ?? null,
          departmentRefId: departmentRef.value?.id ?? null,
          // A password reset revokes every session that account already has.
          // The two writes are in one statement inside one transaction on
          // purpose: a reset that persists but does not revoke is the exact
          // failure sessionsValidFrom exists to prevent, and it must not be
          // reachable by a transaction that half-committed.
          //
          // Only a password reset bumps here. Changing a role, department,
          // email, name, rank or vessel does NOT — the cookie carries only
          // { uid } and all of those are re-read on every request, so the
          // change has already taken effect. Bumping would log someone out
          // for a change that already applied: pure cost, no benefit.
          //
          // An admin-set replacement is also one-time: force the target to
          // /change-password on their next request. This is the ADMIN path;
          // a user changing their OWN password on /change-password goes
          // through the Phase-4 self-serve action, which CLEARS the flag
          // rather than setting it.
          ...(passwordHash
            ? { passwordHash, sessionsValidFrom: new Date(), mustChangePassword: true }
            : {}),
          updatedBy: actor.id,
        },
      });

      // Counted AFTER the write and on the transaction's own client, so the
      // number is the one this change actually leaves behind rather than a
      // prediction made before it. A violation throws, and the role changes
      // roll back with it.
      if (
        guardAdminFloor &&
        (await tx.user.count({ where: activeAdminWhere(actor.companyId) })) === 0
      ) {
        throw new AdminFloorError();
      }
    });
  } catch (err) {
    if (err instanceof AdminFloorError) return fail(LAST_ADMIN);
    if (isUniqueViolation(err)) return fail(EMAIL_TAKEN);
    throw err;
  }

  const currentNames = new Map(target.roles.map((r) => [r.roleId, r.role.name]));
  const added = roles.filter((r) => !currentRoleIds.has(r.id)).map((r) => r.name);
  const removed = [...currentRoleIds]
    .filter((id) => !nextRoleIds.includes(id))
    .map((id) => currentNames.get(id) ?? id);

  const changes: string[] = [];
  if (added.length) changes.push(`granted ${added.join(", ")}`);
  if (removed.length) changes.push(`revoked ${removed.join(", ")}`);
  if (passwordHash) changes.push("reset the password");

  await writeAudit({
    actor,
    action: "UPDATE",
    entityType: "User",
    entityId: target.id,
    summary:
      `${actor.fullName} updated user ${d.fullName} (${d.email})` +
      (changes.length ? ` — ${changes.join("; ")}` : ""),
    metadata: {
      rolesAdded: added,
      rolesRemoved: removed,
      passwordReset: Boolean(passwordHash),
      emailChanged: target.email !== d.email,
      employeeId: d.employeeId?.trim() || null,
      crewId: d.crewId?.trim() || null,
      vessel: vessel.vessel?.name ?? null,
      accessLevel: accessLevel.value?.name ?? null,
      departmentRef: departmentRef.value?.name ?? null,
    },
  });

  revalidatePath("/settings/users");
  revalidatePath(`/settings/users/${target.id}`);
  return OK;
}

// ─── Sign out everywhere ────────────────────────────────────────────────────

/**
 * Revokes every session this account currently holds, without changing
 * anything else about it.
 *
 * An administrator responding to a suspected leaked cookie should not have to
 * change the user's password (which they then have to pass to the crew over
 * the radio) or deactivate the account (which stops them working) just to
 * reach the one thing they actually want.
 *
 * Takes effect on the target's next request, not immediately: getCurrentUser
 * is where the check runs, so a page already rendered stays on screen until
 * they navigate.
 */
export async function signOutEverywhereAction(
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requirePermission("admin:manage-users");
  if (actor.department === "SHIPBOARD") return fail(SHORE_ONLY);
  const parsed = signOutEverywhereSchema.safeParse({
    userId: formData.get("userId"),
  });
  if (!parsed.success) return failFromZod(parsed.error);

  // Company-scoped like every other lookup here: another company's user id
  // reads exactly like one that never existed.
  const target = await prisma.user.findFirst({
    where: { id: parsed.data.userId, companyId: actor.companyId, deletedAt: null },
    select: { id: true, fullName: true, email: true },
  });
  if (!target) return fail(USER_NOT_FOUND);

  // The server's clock, never a client-supplied instant. Held in a local so
  // the row and the audit entry name the same moment rather than two
  // new Date() calls a millisecond apart.
  const signedOutAt = new Date();

  // Inactive accounts are deliberately still targetable: bumping before a
  // reactivation is a reasonable thing to want, and refusing would be a
  // refusal with no security argument behind it.
  await prisma.user.update({
    where: { id: target.id },
    data: { sessionsValidFrom: signedOutAt, updatedBy: actor.id },
  });

  // AuditAction has no dedicated member for this and adding one is an
  // ALTER TYPE against a live database; UPDATE plus an explicit summary is
  // the same compromise setUserActiveAction already makes.
  await writeAudit({
    actor,
    action: "UPDATE",
    entityType: "User",
    entityId: target.id,
    summary: `${actor.fullName} signed ${target.fullName} (${target.email}) out of all devices`,
    metadata: { sessionsValidFrom: signedOutAt.toISOString() },
  });

  revalidatePath("/settings/users");
  revalidatePath(`/settings/users/${target.id}`);
  return OK;
}

// ─── Activate / deactivate ──────────────────────────────────────────────────

export async function setUserActiveAction(
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requirePermission("admin:manage-users");
  if (actor.department === "SHIPBOARD") return fail(SHORE_ONLY);
  const parsed = setUserActiveSchema.safeParse({
    userId: formData.get("userId"),
    active: formData.get("active"),
  });
  if (!parsed.success) return failFromZod(parsed.error);
  const { userId, active } = parsed.data;

  const target = await prisma.user.findFirst({
    where: { id: userId, companyId: actor.companyId, deletedAt: null },
    select: {
      id: true,
      fullName: true,
      email: true,
      active: true,
      roles: { select: { roleId: true } },
    },
  });
  if (!target) return fail(USER_NOT_FOUND);

  // Locking yourself out is the one mistake nobody else can undo for you if
  // you were also the last administrator, and it is never what was meant.
  if (target.id === actor.id && !active) return fail(SELF_DEACTIVATE);

  // Already in the requested state — a stale page. Refresh it rather than
  // writing a no-op audit row.
  if (target.active === active) {
    revalidatePath("/settings/users");
    revalidatePath(`/settings/users/${target.id}`);
    return OK;
  }

  const adminIds = await adminRoleIds(actor.companyId);
  const guardAdminFloor = !active && target.roles.some((r) => adminIds.has(r.roleId));

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: target.id },
        data: {
          active,
          // Deactivation revokes existing sessions. Not because deactivation
          // is broken — getCurrentUser filters on `active`, so it already
          // bites on the next request — but because REACTIVATION would
          // otherwise resurrect any cookie issued before the deactivation,
          // for the remainder of its thirty days. Reactivation itself does
          // not bump: there is nothing to revoke the deactivation bump has
          // not already handled.
          ...(active ? {} : { sessionsValidFrom: new Date() }),
          updatedBy: actor.id,
        },
      });
      // Same shape as updateUserAction: assert the floor on the post-write
      // state, inside the transaction, so a refusal rolls the write back.
      if (
        guardAdminFloor &&
        (await tx.user.count({ where: activeAdminWhere(actor.companyId) })) === 0
      ) {
        throw new AdminFloorError();
      }
    });
  } catch (err) {
    if (err instanceof AdminFloorError) return fail(LAST_ADMIN);
    throw err;
  }

  // AuditAction has no ACTIVATE/DEACTIVATE member and adding one is a schema
  // change to a live database; the summary carries the distinction.
  await writeAudit({
    actor,
    action: "UPDATE",
    entityType: "User",
    entityId: target.id,
    summary: `${actor.fullName} ${active ? "activated" : "deactivated"} user ${target.fullName} (${target.email})`,
    metadata: { active },
  });

  revalidatePath("/settings/users");
  revalidatePath(`/settings/users/${target.id}`);
  return OK;
}
