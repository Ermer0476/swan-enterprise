import { z } from "zod";
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
// E3 no-escalation: an actor who has an access level of their own may not
// assign one ranked above it. Only bites when the actor HAS a level.
export const ACCESS_LEVEL_ABOVE_SELF =
  "You can't assign an access level ranked above your own.";
export const DEPARTMENT_UNAVAILABLE =
  "The selected department is not available. Pick another.";
export const VESSEL_UNAVAILABLE =
  "The selected vessel is not available. Pick another.";
// A ship-side Department (Ship / Shore) derives department = SHIPBOARD, which
// drives vessel scope — so it cannot stand without a vessel to scope to.
export const SHIP_REQUIRES_VESSEL =
  "A ship-side department needs a vessel. Pick the vessel this account is assigned to.";
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

// ─── Employee Masterlist (E1) field helpers ─────────────────────────────────
// Every masterlist field is additive and optional. These factories keep the
// "trim, bound, allow blank" shape identical across the dozen new fields so no
// two of them drift, mirroring how `rank`/`employeeId` above are written.

/** Trimmed, length-bounded, optional-or-blank free text. Output: string | undefined. */
const optText = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

/**
 * The genders the form offers, matched case-insensitively. DELIBERATELY not a
 * hard enum: the legacy masterlist holds free-form values, so an unknown one is
 * accepted as typed rather than rejected on import or re-save. Kept only as the
 * dropdown's option list and as documentation of the canonical spellings.
 */
export const GENDERS = ["Male", "Female"] as const;

/**
 * A Philippine government ID, validated leniently. Blank passes (the field is
 * optional). Otherwise spaces and dashes are stripped and the remainder must be
 * all digits of an allowed length — a soft field error, never a hard refusal
 * that would block saving the rest of the account. The stored value is the
 * user's original trimmed text: this only *checks* a normalized copy, it does
 * NOT normalize what gets written (numbers are kept exactly as the HR clerk
 * typed them, dashes and all).
 */
function phGovId(label: string, allowedLengths: readonly number[]) {
  const lengths = allowedLengths.join(" or ");
  return z
    .string()
    .trim()
    .max(30)
    .optional()
    .or(z.literal(""))
    .refine(
      (v) => {
        if (!v) return true;
        const digits = v.replace(/[\s-]/g, "");
        return /^\d+$/.test(digits) && allowedLengths.includes(digits.length);
      },
      { message: `${label} must be ${lengths} digits.` },
    );
}

/**
 * An optional calendar date from a <input type="date"> (or a blank). Blank and
 * a missing field both resolve to `null`; anything else is coerced and an
 * impossible date (e.g. 2026-02-30, which parses to Invalid Date) is rejected.
 * Output: Date | null, so the action writes it straight through.
 */
const optDate = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : v),
  z.union([z.null(), z.coerce.date()]),
);

/**
 * Cross-field guard shared by create and update: a hire date before the date
 * of birth is a data-entry slip, not a real record. Pathed onto `dateHired` so
 * the message lands on that input rather than floating at the top of the form.
 * Only fires when both dates are present.
 */
function datesConsistent(
  d: { birthDate: Date | null; dateHired: Date | null },
  ctx: z.RefinementCtx,
) {
  if (d.birthDate && d.dateHired && d.dateHired.getTime() < d.birthDate.getTime()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["dateHired"],
      message: "Date hired can't be before the date of birth.",
    });
  }
}

/**
 * Builds a display `fullName` as `LAST, FIRST MIDDLE`, skipping any blank part.
 *
 * Shared on purpose — createUserAction, updateUserAction and a future
 * masterlist importer all compose a name here so the three can never spell one
 * differently. Lives in schema.ts (not actions.ts) because a "use server"
 * module may only export async functions, and this is the same reason the
 * refusal messages live here too.
 *
 * Returns `null` when NO name part is supplied; the callers read that as "the
 * masterlist name fields were left blank, keep the fullName the form already
 * has" — the legacy edit path that only touched the single Full name box.
 * Parts are trimmed; internal spacing (compound surnames like "Dela Cruz") is
 * left untouched. Degrades gracefully when only some parts exist.
 */
export function composeFullName(parts: {
  lastName?: string | null;
  firstName?: string | null;
  middleName?: string | null;
}): string | null {
  const last = (parts.lastName ?? "").trim();
  const first = (parts.firstName ?? "").trim();
  const middle = (parts.middleName ?? "").trim();
  if (!last && !first && !middle) return null;
  const given = [first, middle].filter(Boolean).join(" ");
  if (last && given) return `${last}, ${given}`;
  return last || given;
}

const detailFields = {
  fullName: z.string().trim().min(2, "Full name is required").max(120),
  email: emailField,
  // NOTE: the legacy security-signal `department` (DepartmentType) enum is no
  // longer posted by the form. It is DERIVED on save from the chosen
  // "Department (Ship / Shore)" — see deriveDepartment() in actions.ts — so it
  // is intentionally absent here.
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
  // ── Employee Masterlist (E1) — all optional, additive. Names feed the
  //    composed `LAST, FIRST MIDDLE` fullName in the action; the rest are
  //    HR reference fields shown on the profile. Nothing here is a security
  //    signal. Government IDs use the lenient phGovId check and are stored
  //    as typed (never normalized). ──
  lastName: optText(60),
  firstName: optText(60),
  middleName: optText(60),
  initials: optText(12),
  // Lenient: known set matched case-insensitively at the UI, unknowns accepted.
  gender: optText(30),
  employmentStatus: optText(60),
  designation: optText(100),
  birthDate: optDate,
  dateHired: optDate,
  officialAddress: optText(300),
  tin: phGovId("TIN", [9, 12]),
  sss: phGovId("SSS", [10]),
  hdmf: phGovId("HDMF (Pag-IBIG)", [12]),
  philHealth: phGovId("PhilHealth", [12]),
  // The single consolidated "Access level" = the company's Role that drives
  // requirePermission for this account. The form posts one (`roleId`); the
  // action normalises it into this one-element array (and still accepts a
  // legacy `roleIds` payload). At least one is required, so a saved account
  // can actually reach something once it signs in.
  roleIds: z
    .array(z.string().uuid("Select a valid access level"))
    .min(1, "Select an access level"),
};

export const createUserSchema = z
  .object({
    ...detailFields,
    password: passwordField,
  })
  .superRefine(datesConsistent);

export const updateUserSchema = z
  .object({
    userId: z.string().uuid(),
    ...detailFields,
    // Optional on update: blank means "leave the current password alone".
    password: passwordField.or(z.literal("")).optional(),
  })
  .superRefine(datesConsistent);

/**
 * One row of an Employee Masterlist import (E2), validated with the SAME field
 * rules as the create/edit form's masterlist fields — the very `optText`,
 * `phGovId`, `optDate`, `emailField` and `datesConsistent` pieces `detailFields`
 * is built from, so an imported value can never be looser than a typed one.
 *
 * Only the masterlist columns live here: no `department`, `roleIds`, `password`
 * or access assignments. Those are NOT in the sheet — the commit action supplies
 * them from doctrine (a default department, the guest access level and a minimal
 * role) for a newly-created account, and leaves them untouched on an update.
 * `email` is optional (present only on the CREATE path); the government IDs are
 * checked leniently and stored as typed, exactly as on the form.
 */
export const masterlistImportRowSchema = z
  .object({
    lastName: optText(60),
    firstName: optText(60),
    middleName: optText(60),
    initials: optText(12),
    gender: optText(30),
    employeeId: z.string().trim().max(60).optional().or(z.literal("")),
    employmentStatus: optText(60),
    designation: optText(100),
    birthDate: optDate,
    dateHired: optDate,
    officialAddress: optText(300),
    tin: phGovId("TIN", [9, 12]),
    sss: phGovId("SSS", [10]),
    hdmf: phGovId("HDMF (Pag-IBIG)", [12]),
    philHealth: phGovId("PhilHealth", [12]),
    email: emailField.optional().or(z.literal("")),
  })
  .superRefine(datesConsistent);

export type MasterlistImportRow = z.infer<typeof masterlistImportRowSchema>;

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
