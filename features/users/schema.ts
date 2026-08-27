import { z } from "zod";

/**
 * Password validation shared by every place this app sets a password. Ported
 * from the reference verbatim so the rules cannot drift between an admin-issued
 * password (Phase 5) and a user's own change here.
 */

/**
 * Minimum length for any password this module sets. Kept modest on purpose —
 * an admin has to read it out to the crew member over the phone or radio.
 */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * bcrypt hashes at most the first 72 *bytes* of the input and silently ignores
 * the rest, so anything past that is security theatre — two passwords sharing a
 * 72-byte prefix would be the same password. Reject the overlong one instead of
 * quietly truncating it. Measured in bytes, not characters: one emoji is four
 * bytes.
 */
const BCRYPT_MAX_BYTES = 72;

/**
 * Passwords are deliberately not `.trim()`ed — a leading or trailing space is a
 * legitimate character, and trimming it here would hash something different
 * from what the user later types at the login form.
 */
export const passwordField = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
  .refine(
    (v) => new TextEncoder().encode(v).length <= BCRYPT_MAX_BYTES,
    `Password is too long (max ${BCRYPT_MAX_BYTES} bytes)`,
  );

export const CONFIRM_MISMATCH = "The two passwords do not match";

/**
 * A user setting their OWN password on /change-password — the forced
 * first-login flow and any later voluntary change. Reuses `passwordField`
 * verbatim so the min length, the 72-byte bcrypt cap and the no-trim rule match
 * the password an admin issues; the two must never drift. No current-password
 * field: the forced flow reaches this page immediately after a successful
 * sign-in with the one-time password, so re-entering it would be asking for
 * what was just proven. `confirm` guards the typo, on its own field.
 */
export const changePasswordSchema = z
  .object({
    password: passwordField,
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: CONFIRM_MISMATCH,
    path: ["confirm"],
  });
