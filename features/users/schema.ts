import { z } from "zod";
import { DEPARTMENTS } from "@/features/sms-manual/schema";
import { CREW_ID_RE, CREW_ID_FORMAT_MESSAGE } from "@/features/crewing/crew-id";

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

// ─────────────────────────────────────────────────────────────────────────────
// Phase 5 — User Management (create / edit an account)
// ─────────────────────────────────────────────────────────────────────────────

// ─── Refusal messages ───────────────────────────────────────────────────────
// They live here rather than in actions.ts because a "use server" module may
// only export async functions. Shared so the wording is identical in the
// action that refuses, the form that shows it and any probe that asserts it.

/** A user of another company reads exactly like a user that never existed. */
export const USER_NOT_FOUND = "User not found";
export const EMAIL_TAKEN =
  "That email address is already registered. Use a different one.";
export const EMPLOYEE_ID_TAKEN =
  "That employee ID is already in use. Use a different one.";
export const CREW_ID_TAKEN = "That crew ID is already in use. Use a different one.";
export const ROLE_NOT_FOUND =
  "One of the selected system accesses is not available.";
export const ACCESS_LEVEL_UNAVAILABLE =
  "The selected access level is not available. Pick another.";
export const DEPARTMENT_UNAVAILABLE =
  "The selected department is not available. Pick another.";
export const VESSEL_UNAVAILABLE =
  "The selected vessel is not available. Pick another.";
export const SELF_ROLE_CHANGE =
  "You can't change your own system accesses. Ask another administrator to do it.";
export const SELF_DEPARTMENT_CHANGE =
  "You can't change your own department. Ask another administrator to do it.";
export const SELF_DEACTIVATE =
  "You can't deactivate your own account. Ask another administrator to do it.";
export const LAST_ADMIN =
  "This would leave the company with no active administrator. Give another active user an administrator role first.";

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(200, "Email address is too long");

const detailFields = {
  fullName: z.string().trim().min(2, "Full name is required").max(120),
  email: emailField,
  // The legacy security-signal department enum (SHIPBOARD drives vessel scope,
  // and can match a WorkflowStep.approverDept). Mirrors DepartmentType — see
  // features/sms-manual/schema.ts. Nobody may change their own (SELF_*).
  department: z.enum(DEPARTMENTS, {
    errorMap: () => ({ message: "Select a department" }),
  }),
  rank: z.string().trim().max(60).optional().or(z.literal("")),
  // The company's own staff / shore / employee ID. Free text, optional —
  // uniqueness ("one live account per employee ID") is enforced in the action,
  // not here.
  employeeId: z.string().trim().max(60).optional().or(z.literal("")),
  // The crew ID for a shore user who came from the ships. Format YYYY-99999,
  // validated only when non-empty; blank = a non-seafarer. Uniqueness ("one
  // live account per crew ID") is enforced in the action, not here.
  crewId: z
    .string()
    .trim()
    .max(11)
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || CREW_ID_RE.test(v), CREW_ID_FORMAT_MESSAGE),
  // Blank = an office account, tied to no single vessel.
  vesselId: z.string().uuid("Select a valid vessel").optional().or(z.literal("")),
  // Data-driven access level & department (both optional/nullable). Separate
  // from the legacy `department` enum above, which stays the security signal —
  // see lib/user-access.ts. Blank = unassigned.
  accessLevelId: z.string().uuid("Select a valid access level").optional().or(z.literal("")),
  departmentRefId: z.string().uuid("Select a valid department").optional().or(z.literal("")),
  // "System accesses" in the client's process doc. At least one, so a saved
  // account can actually reach something once it signs in.
  roleIds: z
    .array(z.string().uuid("Select a valid system access"))
    .min(1, "Select at least one system access"),
};

export const createUserSchema = z.object({
  ...detailFields,
  password: passwordField,
});

export const updateUserSchema = z.object({
  userId: z.string().uuid(),
  ...detailFields,
  // Optional on update: blank means "leave the current password alone".
  password: passwordField.or(z.literal("")).optional(),
});

export const setUserActiveSchema = z.object({
  userId: z.string().uuid(),
  active: z.enum(["true", "false"]).transform((v) => v === "true"),
});

/**
 * "Sign out everywhere" carries no payload beyond who to sign out — the
 * instant is the server's `new Date()`, never a client-supplied one, so
 * nothing about when the revocation takes effect is addressable from a form.
 */
export const signOutEverywhereSchema = z.object({
  userId: z.string().uuid(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
