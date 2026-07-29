import { requirePermission } from "@/lib/rbac";
import {
  listDefinitions,
  listRoleNames,
} from "@/features/workflow/admin-queries";
import { DEPARTMENTS } from "@/features/sms-manual/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import {
  WorkflowEditor,
  type DefinitionView,
} from "./workflow-editor";

export default async function WorkflowsPage() {
  const user = await requirePermission("admin:manage-workflows");
  const [definitions, roleNames] = await Promise.all([
    listDefinitions(user.companyId),
    listRoleNames(user.companyId),
  ]);

  const views: DefinitionView[] = definitions.map((d) => ({
    id: d.id,
    name: d.name,
    key: d.key,
    entityType: d.entityType,
    active: d.active,
    steps: d.steps.map((s) => ({
      id: s.id,
      order: s.order,
      name: s.name,
      approverType: s.approverType,
      approverRole: s.approverRole,
      approverDept: s.approverDept,
    })),
  }));

  return (
    <>
      <PageHeader
        title="Approval Workflows"
        description="Configure approval chains without changing code. Steps run top-to-bottom; each is approved by the assigned role or department."
      />
      {views.length === 0 ? (
        <Card className="py-16 text-center text-sm text-muted-foreground">
          No workflow definitions yet.
        </Card>
      ) : (
        <div className="space-y-4">
          {views.map((def) => (
            <WorkflowEditor
              key={def.id}
              definition={def}
              roleNames={roleNames}
              departments={DEPARTMENTS}
            />
          ))}
        </div>
      )}
    </>
  );
}
