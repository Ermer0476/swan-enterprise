import "server-only";
import { requireUser, type SessionUser } from "./auth";
import type { PermissionKey } from "./permissions";

/** Pure check — does this session hold the permission? */
export function can(user: SessionUser, permission: PermissionKey): boolean {
  return user.permissions.has(permission);
}

/**
 * Guard for Server Actions and server components. Returns the user when the
 * permission is held; throws FORBIDDEN otherwise. Always pair a UI-level
 * `can()` check with a server-side `requirePermission()` — never trust the UI.
 */
export async function requirePermission(
  permission: PermissionKey,
): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.permissions.has(permission)) {
    throw new Error("FORBIDDEN");
  }
  return user;
}
