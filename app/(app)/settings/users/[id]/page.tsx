import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/rbac";
import { updateUserAction } from "@/features/users/actions";
import {
  getUser,
  getUserCrewRecord,
  listRoleOptions,
  listUserGovIdDocs,
  listVesselOptions,
} from "@/features/users/queries";
import { type GovIdItem } from "@/components/users/govid-docs";
import { formatCrewName } from "@/features/crewing/ui";
import { listDepartmentOptions } from "@/features/departments/queries";
import { MIN_PASSWORD_LENGTH } from "@/features/users/schema";
import {
  ageFromBirthDate,
  yearsOfServiceFromDateHired,
} from "@/features/users/derive";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { UserForm } from "@/components/users/user-form";
import { cn, formatDate, humanize } from "@/lib/utils";
import { UserActiveActions } from "./user-active-actions";
import { SignOutEverywhereAction } from "./sign-out-everywhere-action";

type DetailRow = { label: string; value: ReactNode };

/**
 * A read-only, collapsible detail group. Native <details>/<summary> — no
 * client JS — with the disclosure marker replaced by a chevron that rotates
 * when open (animation off under prefers-reduced-motion). Renders nothing
 * when the group has no populated rows, keeping empty sections out of view.
 */
function DetailSection({
  title,
  rows,
  defaultOpen = false,
  children,
}: {
  title: string;
  rows: DetailRow[];
  defaultOpen?: boolean;
  children?: ReactNode;
}) {
  if (rows.length === 0 && !children) return null;
  return (
    <details
      open={defaultOpen}
      className={cn(
        "rounded-lg border border-border bg-card text-card-foreground shadow-sm",
        "[&[open]_.detail-chevron]:rotate-180",
      )}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-5 py-4 hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
          className="detail-chevron h-4 w-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none"
        >
          <path
            d="M6 8l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </summary>
      <div className="border-t border-border px-5 py-4">
        {rows.length > 0 && (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            {rows.map((row) => (
              <div key={row.label} className="flex justify-between gap-4 text-sm">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="text-right font-medium text-foreground">{row.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {children}
      </div>
    </details>
  );
}

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requirePermission("admin:manage-users");
  const { id } = await params;

  // getUser is company-scoped: another company's user id is a 404 here, not a
  // permission error, so nothing about it is confirmed to exist.
  const target = await getUser(actor.companyId, id);
  if (!target) notFound();

  const [roles, vessels, departments, crewRecord, govIdDocs] = await Promise.all([
    listRoleOptions(actor.companyId),
    listVesselOptions(actor.companyId),
    listDepartmentOptions(actor.companyId),
    // The crew (Seafarer) record this login belongs to, if any — read-only.
    getUserCrewRecord(actor.companyId, id),
    // Gov-ID scan/photo documents, keyed by gov-ID type.
    listUserGovIdDocs(actor.companyId, id),
  ]);

  // If this account is on a department that has since been deactivated, it
  // won't be in the active-only option list. Merge it back in so the form
  // shows the real current value and a re-save preserves it rather than
  // silently clearing it (the resolver in actions.ts keeps retired-but-owned
  // values on purpose). The access level is no longer set from this form — its
  // current value is carried through as-is — so no merge is needed for it.
  const departmentOptions =
    target.departmentRef && !departments.some((d) => d.id === target.departmentRef!.id)
      ? [...departments, target.departmentRef]
      : departments;

  const isSelf = target.id === actor.id;

  // Read-only detail summary, grouped the same way the edit form is (Account,
  // Personal / Masterlist, Government IDs, Crew / Vessel). Age and years of
  // service are DERIVED at render time from the stored dates (nothing is
  // persisted), and the government IDs are shown as presence only — never the
  // raw number — so this profile view mirrors what the audit log records.
  // Only fields that have a value are listed, to keep each section from
  // becoming a wall of "—"; an empty section renders nothing.
  const push = (
    rows: DetailRow[],
    label: string,
    value: ReactNode,
  ) => {
    if (value) rows.push({ label, value });
  };

  const accountRows: DetailRow[] = [];
  push(accountRows, "Email", target.email);
  push(accountRows, "Department", humanize(target.department));
  push(accountRows, "Rank / position", target.rank);
  push(accountRows, "Employee / Shore ID", target.employeeId);
  push(accountRows, "Access level", target.accessLevel?.name);
  push(accountRows, "Department (Ship / Shore)", target.departmentRef?.name);
  push(
    accountRows,
    "System accesses",
    target.roles.map((r) => r.role.name).join(", ") || null,
  );

  const personalRows: DetailRow[] = [];
  push(personalRows, "Last name", target.lastName);
  push(personalRows, "First name", target.firstName);
  push(personalRows, "Middle name", target.middleName);
  push(personalRows, "Initials", target.initials);
  push(personalRows, "Gender", target.gender);
  push(personalRows, "Employment status", target.employmentStatus);
  push(personalRows, "Designation", target.designation);
  push(
    personalRows,
    "Date of birth",
    target.birthDate
      ? `${formatDate(target.birthDate)} · ${ageFromBirthDate(target.birthDate)} yrs old`
      : null,
  );
  push(
    personalRows,
    "Date hired",
    target.dateHired
      ? `${formatDate(target.dateHired)} · ${yearsOfServiceFromDateHired(target.dateHired)} yrs of service`
      : null,
  );
  push(personalRows, "Official address", target.officialAddress);

  // Gov-ID rows now carry BOTH the number-presence (never the value) and an
  // upload/view/remove control for a scan/photo of the ID, so they render
  // through the interactive GovIdDocs component rather than the read-only dl.
  const govIdItems: GovIdItem[] = [
    { type: "TIN", label: "TIN", numberOnFile: Boolean(target.tin), doc: govIdDocs.get("TIN") ?? null },
    { type: "SSS", label: "SSS", numberOnFile: Boolean(target.sss), doc: govIdDocs.get("SSS") ?? null },
    { type: "HDMF", label: "HDMF (Pag-IBIG)", numberOnFile: Boolean(target.hdmf), doc: govIdDocs.get("HDMF") ?? null },
    { type: "PHILHEALTH", label: "PhilHealth", numberOnFile: Boolean(target.philHealth), doc: govIdDocs.get("PHILHEALTH") ?? null },
  ];

  const crewRows: DetailRow[] = [];
  // The linked crew record, if this login IS a seafarer. A link to the biodata
  // page; the office manages the tie from that side (link / unlink / create).
  push(
    crewRows,
    "Crew record",
    crewRecord ? (
      <Link
        href={`/crewing/seafarers/${crewRecord.id}`}
        className="text-primary hover:underline"
      >
        {crewRecord.crewCode ? `${crewRecord.crewCode} — ` : ""}
        {formatCrewName(crewRecord, "list")}
      </Link>
    ) : null,
  );
  push(crewRows, "Crew ID", target.crewId);
  push(crewRows, "Vessel", target.vessel?.name);

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/settings/users"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to users
      </Link>

      <PageHeader
        title={target.fullName}
        description={`${target.email} · ${humanize(target.department)}${target.rank ? ` · ${target.rank}` : ""} · last sign-in ${target.lastLoginAt ? formatDate(target.lastLoginAt) : "never"}`}
        actions={
          <div className="flex items-center gap-3">
            <Badge tone={target.active ? "success" : "neutral"}>
              {target.active ? "Active" : "Inactive"}
            </Badge>
            {/* Revokes the sessions the account already issued; it does not
                change whether the account may sign in. */}
            <SignOutEverywhereAction
              userId={target.id}
              userName={target.fullName}
              isSelf={isSelf}
            />
            <UserActiveActions
              userId={target.id}
              userName={target.fullName}
              active={target.active}
              isSelf={isSelf}
            />
          </div>
        }
      />

      <div className="mb-5 space-y-3">
        <DetailSection title="Account" rows={accountRows} defaultOpen />
        <DetailSection title="Personal / Masterlist" rows={personalRows} />
        <DetailSection title="Crew / Vessel" rows={crewRows} />
      </div>

      <UserForm
        action={updateUserAction}
        roles={roles}
        vessels={vessels}
        departments={departmentOptions}
        // Edit mode: the account exists, so the Government IDs section renders
        // the interactive scan/photo uploader next to the ID-number fields.
        userId={target.id}
        govIdItems={govIdItems}
        values={{
          id: target.id,
          fullName: target.fullName,
          email: target.email,
          department: target.department,
          rank: target.rank ?? "",
          employeeId: target.employeeId ?? "",
          crewId: target.crewId ?? "",
          vesselId: target.vesselId ?? "",
          accessLevelId: target.accessLevelId ?? "",
          departmentRefId: target.departmentRefId ?? "",
          roleIds: target.roles.map((r) => r.role.id),
          // Employee Masterlist (E1). Dates → YYYY-MM-DD for <input type="date">;
          // they are stored at UTC midnight, so the ISO date slice is exact.
          lastName: target.lastName ?? "",
          firstName: target.firstName ?? "",
          middleName: target.middleName ?? "",
          initials: target.initials ?? "",
          gender: target.gender ?? "",
          employmentStatus: target.employmentStatus ?? "",
          designation: target.designation ?? "",
          birthDate: target.birthDate ? target.birthDate.toISOString().slice(0, 10) : "",
          dateHired: target.dateHired ? target.dateHired.toISOString().slice(0, 10) : "",
          officialAddress: target.officialAddress ?? "",
          tin: target.tin ?? "",
          sss: target.sss ?? "",
          hdmf: target.hdmf ?? "",
          philHealth: target.philHealth ?? "",
        }}
        submitLabel="Save"
        pendingLabel="Saving…"
        confirmPrompt="Save these changes to this account?"
        passwordRequired={false}
        // "Resetting the password signs this user out on all devices" is stated
        // here rather than discovered afterwards: it is a real consequence for
        // someone at sea. A reset is also treated as temporary — the user is
        // forced back to /change-password on their next request (Phase-4 join).
        passwordHint={`Leave blank to keep the current password. Setting one is TEMPORARY: it replaces the password immediately, signs this user out on all devices, and forces them to set their own on next sign-in — at least ${MIN_PASSWORD_LENGTH} characters, and you'll need to pass it to the user yourself.`}
        rolesLockedReason={
          isSelf
            ? "You can't change your own system accesses — ask another administrator to do it."
            : undefined
        }
        cancelHref="/settings/users"
      />
    </div>
  );
}
