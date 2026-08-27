import { z } from "zod";

// ─── Refusal messages ───────────────────────────────────────────────────────
// Here, not in actions.ts, because a "use server" module may only export async
// functions. Shared so the action, the form and any probe use one wording.

export const ACCESS_LEVEL_NOT_FOUND = "Access level not found";
export const ACCESS_LEVEL_SYSTEM_LOCKED =
  "This is a system access level and can't be deactivated.";
export function accessLevelNameTaken(name: string): string {
  return `An access level named "${name}" already exists. Reactivate it instead of adding a duplicate.`;
}

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
