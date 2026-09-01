"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { hashPassword } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { composeFullName } from "@/features/users/schema";
import { formatCrewName } from "./ui";
import { failFromZod, type ActionResult } from "@/features/shared/action-result";

const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

/**
 * "naka tali dapat crewing at user" — a Seafarer (crew biodata, features/crewing)
 * and a User (login account, features/users) are two records for ONE person, and
 * these actions tie them together. The link lives on `Seafarer.userId`
 * (`@unique`, nullable both ways) so it is one-to-one and optional: a seafarer
 * may have no login, a login may have no crew record, and every existing row is
 * unaffected.
 *
 * ── WHY admin:manage-users, NOT crew:* ──
 * Creating or associating a LOGIN is user management, not crew record-keeping.
 * A crewing clerk who may edit biodata must not thereby be able to mint or
 * attach sign-in credentials, so all three actions gate on `admin:manage-users`
 * — the same key the user module's own create/edit paths use — plus the inline
 * office-only refusal (a SHIPBOARD login administering accounts is out of scope,
 * §5.1). Company scope is enforced on every row read from the session, never a
 * form value.
 */
const OFFICE_ONLY = "User management is available from an office account only.";
const SEAFARER_NOT_FOUND = "Seafarer not found";
const USER_NOT_FOUND = "That login account was not found in your company.";
const MISSING_IDS = "A seafarer and a login must both be chosen.";
const SEAFARER_ALREADY_LINKED =
  "This seafarer already has a login linked. Unlink it first to change it.";
const USER_ALREADY_LINKED =
  "That login is already linked to another seafarer.";
const EMAIL_REQUIRED = "Email is required to create a login.";
const EMAIL_TAKEN = "That email address is already registered.";
const NO_ROLE =
  "No role exists to assign — create a role before creating a login.";
/**
 * The seafarer's own crew code and the login's `crewId` are two copies of one
 * number and must not drift. When they are BOTH set and DIFFER, linking is
 * refused rather than silently overwriting either — a mismatch is a data
 * problem for a human to resolve, not something an action should paper over.
 */
const CREW_ID_MISMATCH =
  "This login already carries a different crew ID than the seafarer's crew code. Resolve the mismatch before linking.";

const linkSchema = z.object({
  seafarerId: z.string().uuid(),
  userId: z.string().uuid(),
});

/** A random one-time password for a newly-created login. Long and url-safe:
 * over the 8-char minimum, under the 72-byte bcrypt cap. Only its hash is
 * stored; the plaintext never leaves this function and is never returned,
 * audited or logged — the account is forced to set its own via
 * mustChangePassword. Mirrors the E2 import create path. */
function tempPassword(): string {
  return randomBytes(18).toString("base64url");
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "P2002"
  );
}

/**
 * Link an EXISTING login to a seafarer that has none.
 *
 * Validates that both rows belong to the caller's company, that neither is
 * already linked (the seafarer half, and the login half via its unique
 * back-relation), and that the two crew IDs are consistent. On success sets
 * `Seafarer.userId`, and — only when the login's `crewId` is empty — stamps it
 * from the seafarer's crew code so the two identities agree. Never overwrites a
 * different existing crewId; that is the mismatch fail above.
 */
export async function linkSeafarerToUserAction(
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requirePermission("admin:manage-users");
  if (actor.department === "SHIPBOARD") return fail(OFFICE_ONLY);

  const parsed = linkSchema.safeParse({
    seafarerId: formData.get("seafarerId"),
    userId: formData.get("userId"),
  });
  if (!parsed.success) return fail(MISSING_IDS);
  const { seafarerId, userId } = parsed.data;

  const seafarer = await prisma.seafarer.findFirst({
    where: { id: seafarerId, companyId: actor.companyId, deletedAt: null },
    select: {
      id: true,
      crewCode: true,
      userId: true,
      lastName: true,
      firstName: true,
      middleName: true,
      suffix: true,
    },
  });
  if (!seafarer) return fail(SEAFARER_NOT_FOUND);
  if (seafarer.userId) return fail(SEAFARER_ALREADY_LINKED);

  const target = await prisma.user.findFirst({
    where: { id: userId, companyId: actor.companyId, deletedAt: null },
    select: {
      id: true,
      email: true,
      crewId: true,
      seafarer: { select: { id: true } },
    },
  });
  if (!target) return fail(USER_NOT_FOUND);
  if (target.seafarer && target.seafarer.id !== seafarer.id)
    return fail(USER_ALREADY_LINKED);

  // Crew-ID consistency. Only meaningful when both sides carry a value.
  const seafarerCrewCode = seafarer.crewCode?.trim() || null;
  const userCrewId = target.crewId?.trim() || null;
  let stampCrewId = false;
  if (userCrewId && seafarerCrewCode && userCrewId !== seafarerCrewCode) {
    return fail(CREW_ID_MISMATCH);
  }
  if (!userCrewId && seafarerCrewCode) stampCrewId = true;

  try {
    await prisma.$transaction([
      prisma.seafarer.update({
        where: { id: seafarer.id },
        data: { userId: target.id, updatedBy: actor.id },
      }),
      ...(stampCrewId
        ? [
            prisma.user.update({
              where: { id: target.id },
              data: { crewId: seafarerCrewCode, updatedBy: actor.id },
            }),
          ]
        : []),
    ]);
  } catch (err) {
    // A concurrent link to the same login trips Seafarer.userId's unique index.
    if (isUniqueViolation(err)) return fail(USER_ALREADY_LINKED);
    throw err;
  }

  await writeAudit({
    actor,
    action: "UPDATE",
    entityType: "Seafarer",
    entityId: seafarer.id,
    summary:
      `${actor.fullName} linked seafarer ${formatCrewName(seafarer, "prose")} ` +
      `to login ${target.email}` +
      (stampCrewId ? ` and stamped crew ID ${seafarerCrewCode}` : ""),
    metadata: {
      seafarerId: seafarer.id,
      userId: target.id,
      email: target.email,
      crewCode: seafarerCrewCode,
      stampedCrewId: stampCrewId,
    },
  });

  revalidatePath(`/crewing/seafarers/${seafarer.id}`);
  revalidatePath(`/settings/users/${target.id}`);
  return OK;
}

/**
 * Break the link. Clears `Seafarer.userId` only — the login itself is left
 * intact (it may still sign in), and its `crewId` is deliberately NOT cleared:
 * that is the account's own identifier, not something this action minted.
 */
export async function unlinkSeafarerFromUserAction(
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requirePermission("admin:manage-users");
  if (actor.department === "SHIPBOARD") return fail(OFFICE_ONLY);

  const seafarerId = z.string().uuid().safeParse(formData.get("seafarerId"));
  if (!seafarerId.success) return fail(SEAFARER_NOT_FOUND);

  const seafarer = await prisma.seafarer.findFirst({
    where: { id: seafarerId.data, companyId: actor.companyId, deletedAt: null },
    select: {
      id: true,
      userId: true,
      lastName: true,
      firstName: true,
      middleName: true,
      suffix: true,
      user: { select: { id: true, email: true } },
    },
  });
  if (!seafarer) return fail(SEAFARER_NOT_FOUND);
  // Idempotent: nothing linked is not an error, just a no-op success.
  if (!seafarer.userId || !seafarer.user) return OK;

  const login = seafarer.user;
  await prisma.seafarer.update({
    where: { id: seafarer.id },
    data: { userId: null, updatedBy: actor.id },
  });

  await writeAudit({
    actor,
    action: "UPDATE",
    entityType: "Seafarer",
    entityId: seafarer.id,
    summary:
      `${actor.fullName} unlinked seafarer ${formatCrewName(seafarer, "prose")} ` +
      `from login ${login.email}`,
    metadata: { seafarerId: seafarer.id, userId: login.id, email: login.email },
  });

  revalidatePath(`/crewing/seafarers/${seafarer.id}`);
  revalidatePath(`/settings/users/${login.id}`);
  return OK;
}

const createLoginSchema = z.object({
  seafarerId: z.string().uuid(),
  email: z
    .string()
    .trim()
    .min(1, EMAIL_REQUIRED)
    .email("Enter a valid email address.")
    .max(160),
});

/**
 * Create a NEW login for a seafarer that has none, and link it — one
 * transaction.
 *
 * The account is minted with the same floor of authority as the E2 import
 * create path: the company's `guest` access level, a MINIMAL role (fewest
 * permissions), a random one-time password with mustChangePassword, and
 * `active: true`. It is a SHIPBOARD account (this is the seafarer's own login),
 * carries the seafarer's crew code as its `crewId`, and takes its vessel from
 * the seafarer's current live assignment if there is one. An email is required
 * because a seafarer may have none on file and an account cannot sign in
 * without one.
 */
export async function createLoginForSeafarerAction(
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requirePermission("admin:manage-users");
  if (actor.department === "SHIPBOARD") return fail(OFFICE_ONLY);

  const parsed = createLoginSchema.safeParse({
    seafarerId: formData.get("seafarerId"),
    email: formData.get("email"),
  });
  if (!parsed.success) return failFromZod(parsed.error);
  const { seafarerId, email } = parsed.data;

  const seafarer = await prisma.seafarer.findFirst({
    where: { id: seafarerId, companyId: actor.companyId, deletedAt: null },
    select: {
      id: true,
      crewCode: true,
      userId: true,
      lastName: true,
      firstName: true,
      middleName: true,
      suffix: true,
    },
  });
  if (!seafarer) return fail(SEAFARER_NOT_FOUND);
  if (seafarer.userId) return fail(SEAFARER_ALREADY_LINKED);

  // Global email uniqueness (User.email is unique across the whole table).
  const emailClash = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (emailClash) return fail(EMAIL_TAKEN);

  const fullName = composeFullName(seafarer) ?? formatCrewName(seafarer, "prose");

  // Least authority an account can be given while still being able to sign in —
  // the guest access level by name, the minimal role as this company's role
  // with the fewest permissions (ties broken by name). Same doctrine as E2.
  const guest = await prisma.accessLevel.findFirst({
    where: {
      companyId: actor.companyId,
      name: { equals: "guest", mode: "insensitive" },
    },
    select: { id: true },
  });
  const roles = await prisma.role.findMany({
    where: { companyId: actor.companyId },
    select: { id: true, name: true, _count: { select: { permissions: true } } },
  });
  roles.sort(
    (a, b) =>
      a._count.permissions - b._count.permissions || a.name.localeCompare(b.name),
  );
  const minimalRole = roles[0] ?? null;
  if (!minimalRole) return fail(NO_ROLE);

  // The seafarer's current ship, if he is aboard one: the open assignment
  // (actualSignOffDate null). Null when he is in the shore pool.
  const current = await prisma.crewAssignment.findFirst({
    where: {
      seafarerId: seafarer.id,
      companyId: actor.companyId,
      deletedAt: null,
      actualSignOffDate: null,
    },
    select: { vesselId: true },
  });

  // bcrypt is CPU-bound; hash BEFORE opening the transaction so it is not held
  // open across the hash.
  const passwordHash = await hashPassword(tempPassword());
  const crewId = seafarer.crewCode?.trim() || null;

  let created: { id: string; email: string };
  try {
    created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          companyId: actor.companyId,
          fullName,
          email,
          passwordHash,
          department: "SHIPBOARD",
          crewId,
          vesselId: current?.vesselId ?? null,
          accessLevelId: guest?.id ?? null,
          active: true,
          mustChangePassword: true,
          createdBy: actor.id,
          updatedBy: actor.id,
          roles: { create: [{ roleId: minimalRole.id }] },
        },
        select: { id: true, email: true },
      });
      await tx.seafarer.update({
        where: { id: seafarer.id },
        data: { userId: user.id, updatedBy: actor.id },
      });
      return user;
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
    summary:
      `${actor.fullName} created a login for seafarer ${fullName} (${created.email}) ` +
      `with guest access and role "${minimalRole.name}", and linked it to the crew record`,
    metadata: {
      seafarerId: seafarer.id,
      userId: created.id,
      email: created.email,
      crewCode: crewId,
      vesselId: current?.vesselId ?? null,
      role: minimalRole.name,
    },
  });

  revalidatePath(`/crewing/seafarers/${seafarer.id}`);
  revalidatePath(`/settings/users/${created.id}`);
  return OK;
}
