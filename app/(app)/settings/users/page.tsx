import Link from "next/link";
import { Plus, Upload, Download, Users as UsersIcon } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { listUsers } from "@/features/users/queries";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UsersTable, type UserRowView } from "./users-table";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("admin:manage-users");
  const sp = await searchParams;
  const active =
    sp.status === "active" ? true : sp.status === "inactive" ? false : undefined;
  const users = await listUsers(user.companyId, { search: sp.q || undefined, active });
  const canCreate = can(user, "admin:manage-users");

  // The export download carries the SAME filter the admin is looking at, so
  // what downloads matches what's on screen. A plain <a> (not <Link>) so the
  // route — which writes an EXPORT audit row — is never hit by Link prefetch.
  const exportParams = new URLSearchParams();
  if (sp.q) exportParams.set("q", sp.q);
  if (sp.status) exportParams.set("status", sp.status);
  const exportHref = `/settings/users/export${exportParams.toString() ? `?${exportParams.toString()}` : ""}`;

  const rows: UserRowView[] = users.map((u) => ({
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    department: u.department,
    rank: u.rank,
    roleNames: u.roles.map((r) => r.role.name),
    vesselName: u.vessel?.name ?? null,
    active: u.active,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    isSelf: u.id === user.id,
  }));

  return (
    <>
      <PageHeader
        title="Users"
        description="Accounts, their system accesses and vessel access. Deactivating an account refuses it at sign-in immediately."
        actions={
          canCreate ? (
            <div className="flex flex-wrap items-center gap-2">
              <a href={exportHref}>
                <Button variant="outline"><Download className="h-4 w-4" /> Export</Button>
              </a>
              <Link href="/settings/users/import">
                <Button variant="outline"><Upload className="h-4 w-4" /> Import</Button>
              </Link>
              <Link href="/settings/users/new">
                <Button><Plus className="h-4 w-4" /> Create New User</Button>
              </Link>
            </div>
          ) : undefined
        }
      />

      <form className="mb-4 flex flex-wrap items-end gap-2">
        <div className="min-w-52 flex-1">
          <Input name="q" aria-label="Search by name, email or rank"
            placeholder="Search by name, email or rank…" defaultValue={sp.q ?? ""} />
        </div>
        <Select name="status" defaultValue={sp.status ?? ""} className="w-40">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
        <Button type="submit" variant="outline">Filter</Button>
      </form>

      {rows.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <UsersIcon className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No users match your filters</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {canCreate
              ? "Create a user account to give someone access to the platform."
              : "Adjust the search or status filter to see accounts."}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <UsersTable rows={rows} />
          </div>
        </Card>
      )}
    </>
  );
}
