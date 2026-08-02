import { requirePermission } from "@/lib/rbac";
import { listVesselOptions } from "@/features/external-audits/queries";
import { createExternalAuditAction } from "@/features/external-audits/actions";
import { PageHeader } from "@/components/ui/page-header";
import { AuditForm } from "@/components/audit/audit-form";

export default async function NewExternalAuditPage() {
  const user = await requirePermission("eaudit:create");
  const vessels = await listVesselOptions(user.companyId);
  const isShipboard = user.department === "SHIPBOARD";
  const ownVesselName = vessels.find((v) => v.id === user.vesselId)?.name ?? null;
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="New External Audit"
        description="Create the audit header, then record findings on the detail page."
      />
      <AuditForm
        createAction={createExternalAuditAction}
        vessels={vessels}
        cancelHref="/external-audits"
        bodyLabel="Certifying / verification body"
        bodyPlaceholder="e.g. DNV, Lloyd's Register, Flag State"
        isShipboard={isShipboard}
        ownVesselId={user.vesselId}
        ownVesselName={ownVesselName}
      />
    </div>
  );
}
