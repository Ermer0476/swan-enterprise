import { Building2 } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { listDepartments } from "@/features/departments/queries";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DepartmentsPanel, type DepartmentRowView } from "./departments-panel";

/**
 * Departments admin — the editable list of ship-side and shore-side
 * departments accounts are assigned to. The NAME is free data; the SIDE
 * (ship/shore) is the one fixed axis. Gated `department:read`; editing needs
 * `department:manage`, and without it the page shows a read-only view.
 */
export default async function DepartmentsPage() {
  const user = await requirePermission("department:read");
  const canManage = can(user, "department:manage");

  const departments = await listDepartments(user.companyId);
  const rows: DepartmentRowView[] = departments.map((d) => ({
    id: d.id,
    name: d.name,
    side: d.side,
    description: d.description,
    isSystem: d.isSystem,
    active: d.deletedAt === null,
    userCount: d._count.users,
  }));

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Departments"
        description="The ship-side and shore-side departments accounts are assigned to. Add a department, edit it, or deactivate a non-system one that has no users assigned."
      />

      {!canManage && (
        <Card className="mb-4 border-warning/40 bg-warning/10">
          <CardContent className="flex items-center gap-2 pt-5 text-sm">
            <Building2 className="h-4 w-4 shrink-0 text-warning" />
            You don&apos;t have permission to change these — contact an Administrator. Shown here read-only.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-5">
          {canManage ? <DepartmentsPanel rows={rows} /> : <ReadOnlyTable rows={rows} />}
        </CardContent>
      </Card>
    </div>
  );
}

function ReadOnlyTable({ rows }: { rows: DepartmentRowView[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No departments yet.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">Side</th>
            <th className="px-4 py-2.5 font-medium">Name</th>
            <th className="px-4 py-2.5 font-medium">Description</th>
            <th className="px-4 py-2.5 font-medium">Users</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id} className="border-b border-border last:border-0">
              <td className="px-4 py-2.5">
                <Badge tone={d.side === "SHIP" ? "accent" : "neutral"}>{d.side === "SHIP" ? "Ship" : "Shore"}</Badge>
              </td>
              <td className="px-4 py-2.5">
                <span className="font-medium">{d.name}</span>
                {d.isSystem && <Badge tone="neutral" className="ml-2 align-middle">System</Badge>}
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">{d.description || "—"}</td>
              <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{d.userCount}</td>
              <td className="px-4 py-2.5">
                <Badge tone={d.active ? "success" : "neutral"}>{d.active ? "Active" : "Deactivated"}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
