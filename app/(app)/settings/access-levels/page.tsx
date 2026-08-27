import { Layers } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { listAccessLevels } from "@/features/access-levels/queries";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AccessLevelsPanel, type LevelRowView } from "./access-levels-panel";

/**
 * Access Levels admin — the editable list of user levels (superadmin, admin,
 * viewer, guest, and whatever the office adds). Ordered by rank so the
 * hierarchy is visible; a level can be added between two existing ones by
 * choosing a rank between theirs. Gated `access-level:read`; editing needs
 * `access-level:manage`, and without it the page shows a read-only view.
 */
export default async function AccessLevelsPage() {
  const user = await requirePermission("access-level:read");
  const canManage = can(user, "access-level:manage");

  const levels = await listAccessLevels(user.companyId);
  const rows: LevelRowView[] = levels.map((l) => ({
    id: l.id,
    name: l.name,
    rank: l.rank,
    description: l.description,
    isSystem: l.isSystem,
    active: l.deletedAt === null,
    userCount: l._count.users,
  }));

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Access Levels"
        description="The user levels accounts are classified by, highest rank first. Add a level, edit it, or deactivate a non-system one — deactivating hides it from the user form but keeps accounts already on it."
      />

      {!canManage && (
        <Card className="mb-4 border-warning/40 bg-warning/10">
          <CardContent className="flex items-center gap-2 pt-5 text-sm">
            <Layers className="h-4 w-4 shrink-0 text-warning" />
            You don&apos;t have permission to change these — contact an Administrator. Shown here read-only.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-5">
          {canManage ? <AccessLevelsPanel rows={rows} /> : <ReadOnlyTable rows={rows} />}
        </CardContent>
      </Card>
    </div>
  );
}

function ReadOnlyTable({ rows }: { rows: LevelRowView[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No access levels yet.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">Rank</th>
            <th className="px-4 py-2.5 font-medium">Name</th>
            <th className="px-4 py-2.5 font-medium">Description</th>
            <th className="px-4 py-2.5 font-medium">Users</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l.id} className="border-b border-border last:border-0">
              <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{l.rank}</td>
              <td className="px-4 py-2.5">
                <span className="font-medium">{l.name}</span>
                {l.isSystem && <Badge tone="neutral" className="ml-2 align-middle">System</Badge>}
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">{l.description || "—"}</td>
              <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{l.userCount}</td>
              <td className="px-4 py-2.5">
                <Badge tone={l.active ? "success" : "neutral"}>{l.active ? "Active" : "Deactivated"}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
