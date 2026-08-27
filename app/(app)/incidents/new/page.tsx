import { requirePermission } from "@/lib/rbac";
import { listVesselOptions, getIncidentSubcategoryOptions } from "@/features/incidents/queries";
import { getReporterPositionOptions } from "@/lib/reference-list";
import { PageHeader } from "@/components/ui/page-header";
import { NewIncidentForm } from "./new-incident-form";

export default async function NewIncidentPage() {
  const user = await requirePermission("incident:create");
  const vessels = await listVesselOptions(user.companyId);
  const positions = await getReporterPositionOptions(user.companyId, user.department);
  const subcategoryOptions = await getIncidentSubcategoryOptions(user.companyId);
  const isShipboard = user.department === "SHIPBOARD";
  const ownVesselName = vessels.find((v) => v.id === user.vesselId)?.name ?? null;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Report Incident"
        description="Capture what happened and its consequences. Root cause is established later, during investigation."
      />
      <NewIncidentForm
        vessels={vessels}
        positions={positions}
        subcategoryOptions={subcategoryOptions}
        isShipboard={isShipboard}
        ownVesselId={user.vesselId}
        ownVesselName={ownVesselName}
      />
    </div>
  );
}
