import { requirePermission } from "@/lib/rbac";
import { listVesselOptions } from "@/features/flag-inspections/queries";
import { createFlagInspectionAction } from "@/features/flag-inspections/actions";
import { PageHeader } from "@/components/ui/page-header";
import { AuditForm } from "@/components/audit/audit-form";

export default async function NewFlagInspectionPage() {
  const user = await requirePermission("flaginsp:create");
  const vessels = await listVesselOptions(user.companyId);
  const isShipboard = user.department === "SHIPBOARD";
  const ownVesselName = vessels.find((v) => v.id === user.vesselId)?.name ?? null;
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="New Flag Inspection"
        description="Create the inspection header, then record findings on the detail page."
      />
      <AuditForm
        createAction={createFlagInspectionAction}
        vessels={vessels}
        cancelHref="/flag-inspections"
        bodyLabel="Flag State / Administration"
        bodyPlaceholder="e.g. Panama Maritime Authority, Marshall Islands Registry"
        isShipboard={isShipboard}
        ownVesselId={user.vesselId}
        ownVesselName={ownVesselName}
      />
    </div>
  );
}
