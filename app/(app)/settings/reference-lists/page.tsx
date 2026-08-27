import { ListChecks } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { REFERENCE_REGISTRY, REFERENCE_LIST_KEYS, type ReferenceListKey } from "@/lib/reference-registry";
import { listReferenceListItems, type ReferenceListItemRow } from "@/features/reference-lists/queries";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ReferenceListPanel } from "./reference-list-panel";

export default async function ReferenceListsPage() {
  const user = await requirePermission("reference:read");
  const canManage = can(user, "reference:manage");

  const lists = await Promise.all(
    REFERENCE_LIST_KEYS.map((listKey) => listReferenceListItems(user.companyId, listKey)),
  );
  const byKey = new Map<ReferenceListKey, ReferenceListItemRow[]>(
    REFERENCE_LIST_KEYS.map((listKey, i) => [listKey, lists[i] ?? []]),
  );

  // Group the registered lists by their registry `group` heading — one section
  // per group, one card per list within it.
  const groups: string[] = [];
  for (const listKey of REFERENCE_LIST_KEYS) {
    const g = REFERENCE_REGISTRY[listKey].group;
    if (!groups.includes(g)) groups.push(g);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Reference Lists"
        description="Controlled option lists behind the app's pickers. Add, relabel, reorder or hide options here without a code change. Hiding an option removes it from new entries; records that already hold it are unaffected."
      />

      {!canManage && (
        <Card className="mb-4 border-warning/40 bg-warning/10">
          <CardContent className="flex items-center gap-2 pt-5 text-sm">
            <ListChecks className="h-4 w-4 shrink-0 text-warning" />
            You don&apos;t have permission to change these — contact an Administrator or QHSE Manager. Shown here read-only.
          </CardContent>
        </Card>
      )}

      {groups.map((group) => (
        <section key={group} className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{group}</h2>
          {REFERENCE_LIST_KEYS.filter((listKey) => REFERENCE_REGISTRY[listKey].group === group).map((listKey) => (
            <Card key={listKey} className="mb-4">
              <CardContent className="pt-5">
                {canManage ? (
                  <ReferenceListPanel listKey={listKey} title={REFERENCE_REGISTRY[listKey].label} rows={byKey.get(listKey) ?? []} />
                ) : (
                  <ReadOnlyTable title={REFERENCE_REGISTRY[listKey].label} rows={byKey.get(listKey) ?? []} />
                )}
              </CardContent>
            </Card>
          ))}
        </section>
      ))}
    </div>
  );
}

function ReadOnlyTable({ title, rows }: { title: string; rows: ReferenceListItemRow[] }) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold">{title}</div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No options configured yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Order</th>
                <th className="px-3 py-2 font-medium">Label</th>
                <th className="px-3 py-2 font-medium">Value</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{r.sortOrder}</td>
                  <td className="px-3 py-2">{r.label}</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{r.value}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.active ? "Active" : "Hidden"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
