import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/rbac";
import { createUserAction } from "@/features/users/actions";
import { listRoleOptions, listVesselOptions } from "@/features/users/queries";
import { listDepartmentOptions } from "@/features/departments/queries";
import { PageHeader } from "@/components/ui/page-header";
import { UserForm } from "@/components/users/user-form";

export default async function NewUserPage() {
  const user = await requirePermission("admin:manage-users");
  const [roles, vessels, departments] = await Promise.all([
    listRoleOptions(user.companyId),
    listVesselOptions(user.companyId),
    listDepartmentOptions(user.companyId),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/settings/users"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to users
      </Link>

      <PageHeader
        title="Create New User"
        description="Enter the user's details, choose their system accesses and vessel access, then save."
      />

      <UserForm
        action={createUserAction}
        roles={roles}
        vessels={vessels}
        departments={departments}
        submitLabel="Save"
        pendingLabel="Saving…"
        confirmPrompt="Create this user account?"
        passwordRequired
        // The join with the Phase-4 first-login flow: the password set here is
        // temporary. createUserAction stores it and sets mustChangePassword, so
        // the account is forced to /change-password on its first sign-in.
        passwordHint={`This is a TEMPORARY password. The platform sends no email — pass it to the user yourself; they'll be required to set their own on first sign-in.`}
        cancelHref="/settings/users"
      />
    </div>
  );
}
