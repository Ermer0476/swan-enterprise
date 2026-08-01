import { requirePermission } from "@/lib/rbac";
import { listVesselOptions } from "@/features/internal-audits/queries";
import { createInternalAuditAction } from "@/features/internal-audits/actions";
import { PageHeader } from "@/components/ui/page-header";
import { AuditForm } from "@/components/audit/audit-form";

export default async function NewInternalAuditPage() {
  const user = await requirePermission("iaudit:create");
  const vessels = await listVesselOptions(user.companyId);
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="New Internal Audit"
        description="Create the audit header, then record findings on the detail page."
      />
      <AuditForm
        createAction={createInternalAuditAction}
        vessels={vessels}
        cancelHref="/internal-audits"
        bodyLabel="Auditing team / department"
        bodyPlaceholder="e.g. QHSE Department"
      />
    </div>
  );
}
