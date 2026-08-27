"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireUser, hashPassword, startSession } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { clientIpFrom } from "@/lib/request-ip";
import { changePasswordSchema } from "@/features/users/schema";

export type ChangePasswordState = { error: string | null };

/**
 * The user sets their OWN password — the forced first-login flow reached
 * through the /change-password page, and any later voluntary change.
 *
 * Deliberately NOT permission-guarded: it must work for the exact accounts the
 * forced flow traps (which may hold no permissions yet). It is reached with
 * `requireUser`, and the target is always the session user's own id, never a
 * client-supplied one, so this cannot be steered at another account.
 */
export async function changeMyPasswordAction(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const user = await requireUser();

  const parsed = changePasswordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const passwordHash = await hashPassword(parsed.data.password);

  // One instant, named once: the row's revocation stamp and the audit entry
  // point at the same moment rather than two `new Date()`s a tick apart.
  const changedAt = new Date();

  // The three writes are one statement: the new hash, the cleared one-time
  // flag, and the revocation of every OTHER session this account holds. A
  // change that cleared the flag but did not revoke — or revoked but left the
  // flag set — is exactly the half-state this page exists to close.
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      mustChangePassword: false,
      sessionsValidFrom: changedAt,
      updatedBy: user.id,
    },
  });

  // Re-mint THIS session immediately. sessionsValidFrom was just set to
  // changedAt and the caller's current token was issued earlier, so without a
  // fresh token getCurrentUser would reject it on the very next request and log
  // the user out the instant they set their password. The new token's `iat` is
  // >= changedAt's second (it is minted after), so the whole-second `<`
  // comparison in getCurrentUser lets it survive while every older cookie for
  // this account is refused.
  await startSession(user.id);

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "User",
    entityId: user.id,
    summary: `${user.fullName} changed their own password`,
    metadata: { self: true, passwordChanged: true },
    ipAddress: clientIpFrom(await headers()),
  });

  redirect("/");
}
