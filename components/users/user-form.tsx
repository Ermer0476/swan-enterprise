"use client";

import Link from "next/link";
import * as React from "react";
import { useActionState, useEffect, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { GENDERS, MIN_PASSWORD_LENGTH } from "@/features/users/schema";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { AutoGrowInput, Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GovIdDocs, type GovIdItem } from "@/components/users/govid-docs";

// Same shape as every other module's, including the per-field breakdown.
export type { ActionResult } from "@/features/shared/action-result";
import type { ActionResult } from "@/features/shared/action-result";

/**
 * A required-field asterisk, and a labelled field wrapper — Capt's
 * `space-y-1.5` + `<Label>` markup gathered behind one name for this form the
 * same way app/(app)/crewing/seafarers/field.tsx does for the crewing forms.
 * Local on purpose: not a new app-wide primitive, and it avoids importing the
 * reference's @/components/ui/field, which Capt does not have. The control is
 * passed as children so it keeps its own name/value/onChange.
 */
function RequiredMark() {
  return <span className="ml-0.5 text-danger">*</span>;
}

function Field({
  id,
  label,
  required,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <RequiredMark />}
      </Label>
      {children}
      {hint && !error && <p className="text-xs leading-snug text-muted-foreground">{hint}</p>}
      {error && (
        <p className="text-xs font-medium leading-snug text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * One collapsible group of fields. The header is a real <button> that toggles
 * an `aria-expanded` content region — the accessible minimum, matching Capt's
 * Card/Tailwind styling.
 *
 * The content is kept mounted and merely `hidden` when collapsed, NOT
 * unmounted: this form is submitted as native FormData off the DOM, so an
 * unmounted input would silently drop out of the payload. `hidden`
 * (display:none) controls still post, and disabled ones are the only ones
 * excluded — so nothing here is disabled. The chevron animation is disabled
 * under prefers-reduced-motion.
 */
function CollapsibleSection({
  id,
  title,
  description,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const contentId = `user-section-${id}`;
  return (
    <div className="rounded-md border border-border">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex w-full items-center justify-between gap-3 rounded-md px-4 py-3 text-left hover:bg-muted/40"
      >
        <span>
          <span className="block text-sm font-semibold text-foreground">{title}</span>
          {description && (
            <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
              {description}
            </span>
          )}
        </span>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none",
            open && "rotate-180",
          )}
        >
          <path
            d="M6 8l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div id={contentId} hidden={!open} className="space-y-4 border-t border-border p-4">
        {children}
      </div>
    </div>
  );
}

export type UserFormValues = {
  id?: string;
  fullName: string;
  email: string;
  department: string;
  rank: string;
  employeeId: string;
  crewId: string;
  vesselId: string;
  accessLevelId: string;
  departmentRefId: string;
  roleIds: string[];
  // ── Employee Masterlist (E1). birthDate/dateHired are held as YYYY-MM-DD
  //    strings for <input type="date">; the pages map Date → that on the way
  //    in, and the action coerces back to a Date on the way out. ──
  lastName: string;
  firstName: string;
  middleName: string;
  initials: string;
  gender: string;
  employmentStatus: string;
  designation: string;
  birthDate: string;
  dateHired: string;
  officialAddress: string;
  tin: string;
  sss: string;
  hdmf: string;
  philHealth: string;
};

export type RoleOption = { id: string; name: string; description: string | null };
export type DepartmentOption = { id: string; name: string; side: "SHIP" | "SHORE" };

const EMPTY: UserFormValues = {
  fullName: "",
  email: "",
  department: "MARINE",
  rank: "",
  employeeId: "",
  crewId: "",
  vesselId: "",
  accessLevelId: "",
  departmentRefId: "",
  roleIds: [],
  lastName: "",
  firstName: "",
  middleName: "",
  initials: "",
  gender: "",
  employmentStatus: "",
  designation: "",
  birthDate: "",
  dateHired: "",
  officialAddress: "",
  tin: "",
  sss: "",
  hdmf: "",
  philHealth: "",
};

// Which field (form `name`) lives in which collapsible section — used to
// auto-expand a collapsed section when the server reports an error in one of
// its fields, so an admin is never stuck on a hidden invalid field. Order
// matters: the render order below matches these keys.
const SECTION_IDS = ["account", "personal", "govId", "crewVessel"] as const;
type SectionId = (typeof SECTION_IDS)[number];

const SECTION_FIELDS: Record<SectionId, readonly string[]> = {
  account: [
    "fullName",
    "email",
    "rank",
    "employeeId",
    "roleId",
    "roleIds",
    "departmentRefId",
    "password",
  ],
  personal: [
    "lastName",
    "firstName",
    "middleName",
    "initials",
    "gender",
    "employmentStatus",
    "designation",
    "birthDate",
    "dateHired",
    "officialAddress",
  ],
  govId: ["tin", "sss", "hdmf", "philHealth"],
  crewVessel: ["crewId", "vesselId"],
};

/**
 * Create/edit form for a user account, shared by both pages.
 *
 * Every field is controlled. A Server Action resolving makes the browser
 * reset the <form>, which on a rejected submission would otherwise wipe
 * everything the admin just typed; holding the values in state instead makes
 * that reset a no-op.
 *
 * The fields are grouped into collapsible sections — Account (open by
 * default), Personal / Masterlist, Government IDs and Crew / Vessel — so the
 * long form isn't shown all at once. All controls stay mounted while
 * collapsed (see CollapsibleSection) so nothing drops out of the submission.
 *
 * ── Why the fields sit OUTSIDE the <form> element and reference it by id ──
 * The Government IDs section embeds <GovIdDocs>, whose upload/remove controls
 * are their OWN <form>s posting to their own server actions. A <form> may not
 * be nested inside another <form> (invalid HTML), so the account form cannot
 * physically wrap the uploader. Rather than reorder the sections, the account
 * <form> is a thin element at the bottom holding only the submit buttons (so
 * useFormStatus still sees pending) and the hidden userId; every field control
 * is associated to it by the HTML `form={formId}` attribute. A form's FormData
 * includes every control that names it as its form owner, wherever it sits in
 * the DOM — so the payload is identical to a wrapping <form>, while the
 * uploader's <form>s remain siblings, never nested.
 *
 * Saving is two-step — "Save" then "Yes, save" — a confirmation before an
 * account is created or changed.
 */
export function UserForm({
  action,
  roles,
  vessels,
  departments,
  values = EMPTY,
  submitLabel,
  pendingLabel,
  confirmPrompt,
  passwordRequired,
  passwordHint,
  rolesLockedReason,
  cancelHref,
  userId,
  govIdItems,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  roles: RoleOption[];
  vessels: { id: string; name: string }[];
  departments: DepartmentOption[];
  values?: UserFormValues;
  submitLabel: string;
  pendingLabel: string;
  confirmPrompt: string;
  passwordRequired: boolean;
  passwordHint: string;
  /** Set when the admin is editing their own account — see SELF_ROLE_CHANGE. */
  rolesLockedReason?: string;
  cancelHref: string;
  /**
   * Edit mode only: the account these documents attach to, and the gov-ID
   * scan/photo rows. Absent on create (no account to attach to yet), so the
   * uploader is not rendered and a hint is shown instead.
   */
  userId?: string;
  govIdItems?: GovIdItem[];
}) {
  const [form, setForm] = useState<UserFormValues>(values);
  // The consolidated single "Access level" = one company Role. On edit,
  // preselect the user's current (primary) role — the first of their roles;
  // an existing multi-role account is collapsed to this one on save.
  const [roleId, setRoleId] = useState<string>(values.roleIds[0] ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [openSections, setOpenSections] = useState<Record<SectionId, boolean>>({
    account: true,
    personal: false,
    govId: false,
    crewVessel: false,
  });
  const [state, formAction] = useActionState<ActionResult, FormData>(action, {
    ok: false,
    error: null,
  });

  // The account <form> lives at the bottom; every field control associates to
  // it by this id (see the component doc-comment).
  const formId = useId();

  // Drop back out of the confirmation step once the action has answered, so a
  // refused save can be corrected and re-confirmed.
  useEffect(() => {
    setConfirming(false);
    if (state.ok) setPassword("");
  }, [state]);

  // A rejected submission can flag a field inside a collapsed section. Expand
  // any section that owns a flagged field so the error is visible and the
  // admin can fix it — never leave them stuck on a hidden invalid field.
  useEffect(() => {
    const fe = state.fieldErrors;
    if (!fe) return;
    const flagged = Object.keys(fe);
    if (flagged.length === 0) return;
    setOpenSections((prev) => {
      const next = { ...prev };
      for (const sid of SECTION_IDS) {
        if (SECTION_FIELDS[sid].some((f) => flagged.includes(f))) next[sid] = true;
      }
      return next;
    });
  }, [state]);

  const rolesLocked = Boolean(rolesLockedReason);
  const fieldErrors = state.fieldErrors;

  const shipDepartments = departments.filter((d) => d.side === "SHIP");
  const shoreDepartments = departments.filter((d) => d.side === "SHORE");

  // Show the ID-document uploader only in edit mode (an account exists to
  // attach files to). On create there is nothing to post against yet.
  const showGovIdDocs = Boolean(userId) && Array.isArray(govIdItems);

  // Gender is lenient: the dropdown offers the known set but a legacy/unknown
  // value (any spelling) must survive a re-save, so it is appended as its own
  // option rather than dropped. Mirrors how the edit page keeps a retired
  // access level selectable.
  const genderIsKnown = GENDERS.some((g) => g === form.gender);

  function toggleSection(id: SectionId) {
    setOpenSections((s) => ({ ...s, [id]: !s[id] }));
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="space-y-4">
          {/* ── Account — the sign-in essentials, open by default. ── */}
          <CollapsibleSection
            id="account"
            title="Account"
            description="Sign-in details and system access."
            open={openSections.account}
            onToggle={() => toggleSection("account")}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                id="fullName"
                label="Full name"
                required
                error={fieldErrors?.fullName}
                hint="As it should appear on reports this person files."
              >
                <Input
                  id="fullName"
                  name="fullName"
                  form={formId}
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  placeholder="e.g. Capt. Ramon Reyes"
                  autoComplete="off"
                />
              </Field>
              <Field
                id="email"
                label="Email (sign-in name)"
                required
                error={fieldErrors?.email}
                hint="This is what they type to sign in, so it has to be one they can reach."
              >
                <Input
                  id="email"
                  name="email"
                  form={formId}
                  type="email"
                  inputMode="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="e.g. rreyes@swanshipping.com"
                  autoComplete="off"
                />
              </Field>
              <Field
                id="rank"
                label="Rank / position"
                error={fieldErrors?.rank}
                hint="Their rank on board or title ashore — shown next to their name on the records they raise."
              >
                <Input
                  id="rank"
                  name="rank"
                  form={formId}
                  value={form.rank}
                  onChange={(e) => setForm({ ...form, rank: e.target.value })}
                  placeholder="e.g. Master, Marine Supt"
                  autoComplete="off"
                />
              </Field>
              <Field
                id="employeeId"
                label="Employee / Shore ID"
                error={fieldErrors?.employeeId}
                hint="The company's own staff number for this person. Must be unique."
              >
                <Input
                  id="employeeId"
                  name="employeeId"
                  form={formId}
                  value={form.employeeId}
                  onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                  placeholder="e.g. SW-0142"
                  autoComplete="off"
                />
              </Field>
            </div>

            {/* Access level & department, plus the password. "Access level" is
                the single consolidated control: one company Role, which drives
                requirePermission for this account (the RBAC engine). The
                Department (Ship / Shore) also derives the security department on
                save — ship ⇒ SHIPBOARD (needs a vessel), shore/none ⇒ ADMIN. */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                id="roleId"
                label="Access level"
                required={!rolesLocked}
                error={fieldErrors?.roleId ?? fieldErrors?.roleIds}
                hint={
                  rolesLockedReason ??
                  "What this account can do once it signs in. Roles are managed under Settings › Access Levels / Roles."
                }
              >
                <Select
                  id="roleId"
                  // A disabled select posts nothing; when locked (self-edit) the
                  // hidden inputs below re-post the current role(s) unchanged so
                  // the save leaves this account's access untouched.
                  name={rolesLocked ? undefined : "roleId"}
                  form={formId}
                  value={roleId}
                  disabled={rolesLocked}
                  onChange={(e) => setRoleId(e.target.value)}
                >
                  <option value="">— Select an access level —</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </Select>
              </Field>
              {/* accessLevelId is no longer set from this form; preserve the
                  account's current value (blank for a new account) so nothing
                  already assigned is silently cleared. */}
              <input type="hidden" name="accessLevelId" form={formId} value={form.accessLevelId} />
              {rolesLocked &&
                form.roleIds.map((id) => (
                  <input key={id} type="hidden" name="roleIds" form={formId} value={id} />
                ))}
              <Field
                id="departmentRefId"
                label="Department (Ship / Shore)"
                error={fieldErrors?.departmentRefId}
                hint="From Settings › Departments. A ship-side choice puts this account on shipboard scope and needs a vessel below; a shore choice keeps it ashore."
              >
                <Select
                  id="departmentRefId"
                  name="departmentRefId"
                  form={formId}
                  value={form.departmentRefId}
                  onChange={(e) => setForm({ ...form, departmentRefId: e.target.value })}
                >
                  <option value="">— None —</option>
                  {shipDepartments.length > 0 && (
                    <optgroup label="Ship">
                      {shipDepartments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </optgroup>
                  )}
                  {shoreDepartments.length > 0 && (
                    <optgroup label="Shore">
                      {shoreDepartments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </optgroup>
                  )}
                </Select>
              </Field>

              {/* Password — two controls on one row (the box and its Show
                  toggle), so this one stays hand-wired rather than going
                  through <Field>, which takes a single child. */}
              <div className="space-y-1.5">
                <Label htmlFor="password">
                  {passwordRequired ? "Temporary password" : "New password"}
                  {passwordRequired && <RequiredMark />}
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="password"
                    name="password"
                    form={formId}
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={passwordRequired ? MIN_PASSWORD_LENGTH : undefined}
                    required={passwordRequired}
                    aria-describedby={fieldErrors?.password ? "password-hint password-error" : "password-hint"}
                    aria-invalid={fieldErrors?.password ? true : undefined}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowPassword((s) => !s)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </Button>
                </div>
                <p id="password-hint" className="text-xs leading-snug text-muted-foreground">
                  {passwordHint} At least {MIN_PASSWORD_LENGTH} characters — keep it something you can
                  read out over the phone or radio.
                </p>
                {fieldErrors?.password && (
                  <p id="password-error" className="text-xs font-medium leading-snug text-danger" role="alert">
                    {fieldErrors.password}
                  </p>
                )}
              </div>
            </div>
          </CollapsibleSection>

          {/* ── Personal / Masterlist (E1) ──
              All optional. The name parts drive the composed
              "LAST, FIRST MIDDLE" fullName in the action; the rest are HR
              reference fields. */}
          <CollapsibleSection
            id="personal"
            title="Personal / Masterlist"
            description="Optional HR details. Fill the name parts to file this person as “Last, First Middle”; leave them blank to keep the Full name above."
            open={openSections.personal}
            onToggle={() => toggleSection("personal")}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="lastName" label="Last name" error={fieldErrors?.lastName}>
                <Input
                  id="lastName"
                  name="lastName"
                  form={formId}
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  autoComplete="off"
                />
              </Field>
              <Field id="firstName" label="First name" error={fieldErrors?.firstName}>
                <Input
                  id="firstName"
                  name="firstName"
                  form={formId}
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  autoComplete="off"
                />
              </Field>
              <Field id="middleName" label="Middle name" error={fieldErrors?.middleName}>
                <Input
                  id="middleName"
                  name="middleName"
                  form={formId}
                  value={form.middleName}
                  onChange={(e) => setForm({ ...form, middleName: e.target.value })}
                  autoComplete="off"
                />
              </Field>
              <Field
                id="initials"
                label="Initials"
                error={fieldErrors?.initials}
                hint="e.g. R.R.R."
              >
                <Input
                  id="initials"
                  name="initials"
                  form={formId}
                  value={form.initials}
                  onChange={(e) => setForm({ ...form, initials: e.target.value })}
                  autoComplete="off"
                />
              </Field>
              <Field id="gender" label="Gender" error={fieldErrors?.gender}>
                <Select
                  id="gender"
                  name="gender"
                  form={formId}
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value })}
                >
                  <option value="">— Not set —</option>
                  {GENDERS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                  {form.gender && !genderIsKnown && (
                    <option value={form.gender}>{form.gender}</option>
                  )}
                </Select>
              </Field>
              <Field
                id="employmentStatus"
                label="Employment status"
                error={fieldErrors?.employmentStatus}
                hint="e.g. Regular, Probationary, Contractual."
              >
                <Input
                  id="employmentStatus"
                  name="employmentStatus"
                  form={formId}
                  value={form.employmentStatus}
                  onChange={(e) => setForm({ ...form, employmentStatus: e.target.value })}
                  autoComplete="off"
                />
              </Field>
              <Field
                id="designation"
                label="Designation"
                error={fieldErrors?.designation}
                hint="Their masterlist job title — separate from the Rank above."
              >
                <Input
                  id="designation"
                  name="designation"
                  form={formId}
                  value={form.designation}
                  onChange={(e) => setForm({ ...form, designation: e.target.value })}
                  autoComplete="off"
                />
              </Field>
              <Field id="birthDate" label="Date of birth" error={fieldErrors?.birthDate}>
                <Input
                  id="birthDate"
                  name="birthDate"
                  form={formId}
                  type="date"
                  value={form.birthDate}
                  onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                />
              </Field>
              <Field
                id="dateHired"
                label="Date hired"
                error={fieldErrors?.dateHired}
                hint="Can't be before the date of birth."
              >
                <Input
                  id="dateHired"
                  name="dateHired"
                  form={formId}
                  type="date"
                  value={form.dateHired}
                  onChange={(e) => setForm({ ...form, dateHired: e.target.value })}
                />
              </Field>
            </div>

            <Field
              id="officialAddress"
              label="Official address"
              error={fieldErrors?.officialAddress}
            >
              <AutoGrowInput
                id="officialAddress"
                name="officialAddress"
                form={formId}
                value={form.officialAddress}
                onChange={(e) => setForm({ ...form, officialAddress: e.target.value })}
                autoComplete="off"
              />
            </Field>
          </CollapsibleSection>

          {/* ── Government IDs ──
              The four ID numbers (validated leniently, stored as typed) AND,
              in edit mode, the scan/photo of each ID — consolidated here so
              there is one obvious place for both. <GovIdDocs> carries its own
              upload/remove <form>s; it sits in this section but OUTSIDE the
              account <form> element (which is the thin one at the bottom), so
              no <form> is nested inside another. */}
          <CollapsibleSection
            id="govId"
            title="Government IDs"
            description="Optional. Digits only; dashes are ignored."
            open={openSections.govId}
            onToggle={() => toggleSection("govId")}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                id="tin"
                label="TIN"
                error={fieldErrors?.tin}
                hint="9 or 12 digits. Dashes optional."
              >
                <Input
                  id="tin"
                  name="tin"
                  form={formId}
                  inputMode="numeric"
                  value={form.tin}
                  onChange={(e) => setForm({ ...form, tin: e.target.value })}
                  autoComplete="off"
                />
              </Field>
              <Field
                id="sss"
                label="SSS"
                error={fieldErrors?.sss}
                hint="10 digits. Dashes optional."
              >
                <Input
                  id="sss"
                  name="sss"
                  form={formId}
                  inputMode="numeric"
                  value={form.sss}
                  onChange={(e) => setForm({ ...form, sss: e.target.value })}
                  autoComplete="off"
                />
              </Field>
              <Field
                id="hdmf"
                label="HDMF (Pag-IBIG)"
                error={fieldErrors?.hdmf}
                hint="12 digits. Dashes optional."
              >
                <Input
                  id="hdmf"
                  name="hdmf"
                  form={formId}
                  inputMode="numeric"
                  value={form.hdmf}
                  onChange={(e) => setForm({ ...form, hdmf: e.target.value })}
                  autoComplete="off"
                />
              </Field>
              <Field
                id="philHealth"
                label="PhilHealth"
                error={fieldErrors?.philHealth}
                hint="12 digits. Dashes optional."
              >
                <Input
                  id="philHealth"
                  name="philHealth"
                  form={formId}
                  inputMode="numeric"
                  value={form.philHealth}
                  onChange={(e) => setForm({ ...form, philHealth: e.target.value })}
                  autoComplete="off"
                />
              </Field>
            </div>

            {/* ID scans/photos. Editing an existing account → the interactive
                uploader; creating one → a hint, since there is no account to
                attach a file to until it is saved. */}
            <div className="space-y-2 border-t border-border pt-4">
              <p className="text-sm font-medium text-foreground">ID documents (scan/photo)</p>
              {showGovIdDocs ? (
                <GovIdDocs userId={userId!} items={govIdItems!} editable />
              ) : (
                <p className="text-xs text-muted-foreground">
                  Save the user first, then upload ID scans on edit.
                </p>
              )}
            </div>
          </CollapsibleSection>

          {/* ── Crew / Vessel ── */}
          <CollapsibleSection
            id="crewVessel"
            title="Crew / Vessel"
            description="Seafarer link and the vessel this account represents."
            open={openSections.crewVessel}
            onToggle={() => toggleSection("crewVessel")}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                id="crewId"
                label="Crew ID"
                error={fieldErrors?.crewId}
                hint="For a shore staff member who came from the ships. Format 2026-00042. Leave blank for non-seafarers."
              >
                <Input
                  id="crewId"
                  name="crewId"
                  form={formId}
                  value={form.crewId}
                  onChange={(e) => setForm({ ...form, crewId: e.target.value })}
                  placeholder="e.g. 2026-00042"
                  autoComplete="off"
                />
              </Field>
              <Field
                id="vesselId"
                label="Vessel access"
                error={fieldErrors?.vesselId}
                hint="The vessel this account represents. A shipboard account is tied to its own ship; an office account files against any vessel."
              >
                <Select
                  id="vesselId"
                  name="vesselId"
                  form={formId}
                  value={form.vesselId}
                  onChange={(e) => setForm({ ...form, vesselId: e.target.value })}
                >
                  <option value="">— Office account (all vessels) —</option>
                  {vessels.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </Select>
              </Field>
            </div>
          </CollapsibleSection>

          {state.error && (
            <p className="text-sm text-danger" role="alert">{state.error}</p>
          )}
          {state.ok && !confirming && (
            <p className="text-sm text-success" role="status">Saved.</p>
          )}

          {/* ── The account <form> itself: thin, at the bottom, holding only
              the hidden userId and the submit controls. Every field above
              names it via `form={formId}`; useFormStatus inside ConfirmRow
              works because the submit button is a real child of this form. ── */}
          <form id={formId} action={formAction}>
            {form.id && <input type="hidden" name="userId" value={form.id} />}

            {/* ── Save, then confirm ── */}
            {confirming ? (
              <ConfirmRow
                prompt={confirmPrompt}
                submitLabel={submitLabel}
                pendingLabel={pendingLabel}
                onCancel={() => setConfirming(false)}
              />
            ) : (
              <div className="flex items-center gap-2">
                <Button type="button" onClick={() => setConfirming(true)}>
                  {submitLabel}
                </Button>
                <Link href={cancelHref}>
                  <Button type="button" variant="ghost">Cancel</Button>
                </Link>
              </div>
            )}
          </form>
        </div>
      </CardContent>
    </Card>
  );
}

function ConfirmRow({
  prompt,
  submitLabel,
  pendingLabel,
  onCancel,
}: {
  prompt: string;
  submitLabel: string;
  pendingLabel: string;
  onCancel: () => void;
}) {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
      <span>{prompt}</span>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? pendingLabel : `Yes, ${submitLabel.toLowerCase()}`}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onCancel}
        disabled={pending}
      >
        Cancel
      </Button>
    </div>
  );
}
