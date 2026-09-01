import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/rbac";
import { updateUserAction } from "@/features/users/actions";
import {
  getUser,
  listRoleOptions,
  listVesselOptions,
} from "@/features/users/queries";
import { listAccessLevelOptions } from "@/features/access-levels/queries";
import { listDepartmentOptions } from "@/features/departments/queries";
import { MIN_PASSWORD_LENGTH } from "@/features/users/schema";
import {
  ageFromBirthDate,
  yearsOfServiceFromDateHired,
} from "@/features/users/derive";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { UserForm } from "@/components/users/user-form";
import { formatDate, humanize } from "@/lib/utils";
import { UserActiveActions } from "./user-active-actions";
import { SignOutEverywhereAction } from "./sign-out-everywhere-action";

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

  const [roles, vessels, accessLevels, departments] = await Promise.all([
    listRoleOptions(actor.companyId),
    listVesselOptions(actor.companyId),
    listAccessLevelOptions(actor.companyId),
    listDepartmentOptions(actor.companyId),
  ]);

  // If this account is on a level/department that has since been deactivated,
  // it won't be in the active-only option lists. Merge it back in so the form
  // shows the real current value and a re-save preserves it rather than
  // silently clearing it (the resolver in actions.ts keeps retired-but-owned
  // values on purpose).
  const accessLevelOptions =
    target.accessLevel && !accessLevels.some((a) => a.id === target.accessLevel!.id)
      ? [...accessLevels, { id: target.accessLevel.id, name: target.accessLevel.name }]
      : accessLevels;
  const departmentOptions =
    target.departmentRef && !departments.some((d) => d.id === target.departmentRef!.id)
      ? [...departments, target.departmentRef]
      : departments;

  const isSelf = target.id === actor.id;

  // Read-only Employee Masterlist summary. Age and years of service are
  // DERIVED at render time from the stored dates (nothing is persisted), and
  // the government IDs are shown as presence only — never the raw number — so
  // this profile view mirrors what the audit log records. Only fields that
  // have a value are listed, to keep the panel from becoming a wall of "—".
  const masterlistRows: { label: string; value: string }[] = [];
  const addRow = (label: string, value: string | null | undefined) => {
    if (value) masterlistRows.push({ label, value });
  };
  addRow("Last name", target.lastName);
  addRow("First name", target.firstName);
  addRow("Middle name", target.middleName);
  addRow("Initials", target.initials);
  addRow("Gender", target.gender);
  addRow("Employment status", target.employmentStatus);
  addRow("Designation", target.designation);
  addRow(
    "Date of birth",
    target.birthDate
      ? `${formatDate(target.birthDate)} · ${ageFromBirthDate(target.birthDate)} yrs old`
      : null,
  );
  addRow(
    "Date hired",
    target.dateHired
      ? `${formatDate(target.dateHired)} · ${yearsOfServiceFromDateHired(target.dateHired)} yrs of service`
      : null,
  );
  addRow("Official address", target.officialAddress);
  addRow("TIN", target.tin ? "On file" : null);
  addRow("SSS", target.sss ? "On file" : null);
  addRow("HDMF (Pag-IBIG)", target.hdmf ? "On file" : null);
  addRow("PhilHealth", target.philHealth ? "On file" : null);

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

      {masterlistRows.length > 0 && (
        <Card className="mb-5">
          <CardContent className="pt-5">
            <h2 className="mb-3 text-sm font-semibold text-foreground">
              Employee Masterlist
            </h2>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              {masterlistRows.map((row) => (
                <div key={row.label} className="flex justify-between gap-4 text-sm">
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd className="text-right font-medium text-foreground">{row.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}

      <UserForm
        action={updateUserAction}
        roles={roles}
        vessels={vessels}
        accessLevels={accessLevelOptions}
        departments={departmentOptions}
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
