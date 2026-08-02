import { requirePermission } from "@/lib/rbac";
import { listVesselOptions } from "@/features/defects/queries";
import { PageHeader } from "@/components/ui/page-header";
import { NewDefectForm } from "./new-defect-form";

export default async function NewDefectPage() {
  const user = await requirePermission("defect:create");
  const vessels = await listVesselOptions(user.companyId);
  const isShipboard = user.department === "SHIPBOARD";
  const ownVesselName = vessels.find((v) => v.id === user.vesselId)?.name ?? null;
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Report Defect"
        description="Log an equipment or machinery defect for tracking to rectification."
      />
      <NewDefectForm
        vessels={vessels}
        isShipboard={isShipboard}
        ownVesselId={user.vesselId}
        ownVesselName={ownVesselName}
      />
    </div>
  );
}
