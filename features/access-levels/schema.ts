import { z } from "zod";
import { ALL_PERMISSION_KEYS } from "@/lib/permissions";

// ─── Refusal messages ───────────────────────────────────────────────────────
// Here, not in actions.ts, because a "use server" module may only export async
// functions. Shared so the action, the form and any probe use one wording.

export const ACCESS_LEVEL_NOT_FOUND = "Access level not found";
export const ACCESS_LEVEL_SYSTEM_LOCKED =
  "This is a system access level and can't be deactivated.";
export function accessLevelNameTaken(name: string): string {
  return `An access level named "${name}" already exists. Reactivate it instead of adding a duplicate.`;
}

// ─── E3 no-escalation refusals (permission-matrix editing) ──────────────────
export const ACCESS_LEVEL_RANK_ABOVE =
  "You can't edit an access level ranked above your own.";
export const PERMISSION_NOT_IN_CEILING =
  "You can't grant a permission your own access level doesn't hold.";

// Every catalog key, as a Set for O(1) membership in the matrix input check.
const PERMISSION_KEY_SET = new Set<string>(ALL_PERMISSION_KEYS);

/**
 * The matrix save: one access level and the exact set of permission KEYS it
 * should grant (the checked cells the actor controls). Keys are deduped and each
 * must be a real catalog key; the no-escalation subset/rank guards live in the
 * action, not here, because they depend on the actor's own effective set.
 */
export const saveAccessLevelPermissionsSchema = z.object({
  accessLevelId: z.string().uuid(),
  permissionKeys: z
    .array(z.string())
    .transform((keys) => Array.from(new Set(keys)))
    .refine((keys) => keys.every((k) => PERMISSION_KEY_SET.has(k)), {
      message: "One of the selected permissions is not recognized.",
    }),
});

/**
 * `rank` orders the levels (higher = more privilege). Kept a plain bounded
 * integer with intentional gaps in the seed (20/40/80/100) so a future level
 * slots between two existing ones without renumbering.
 */
export const saveAccessLevelSchema = z.object({
  accessLevelId: z.string().uuid().optional().or(z.literal("")),
  name: z.string().trim().min(1, "Name is required").max(60),
  rank: z.coerce
    .number({ invalid_type_error: "Rank must be a whole number" })
    .int("Rank must be a whole number")
    .min(0, "Rank can't be negative")
    .max(100000, "Rank is too large"),
  description: z.string().trim().max(500).optional().or(z.literal("")),
});

export const toggleAccessLevelSchema = z.object({
  accessLevelId: z.string().uuid(),
});

export type SaveAccessLevelInput = z.infer<typeof saveAccessLevelSchema>;
