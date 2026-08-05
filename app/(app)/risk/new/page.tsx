import { requirePermission } from "@/lib/rbac";
import { listVesselOptions } from "@/features/risk/queries";
import { PageHeader } from "@/components/ui/page-header";
import { NewRiskAssessmentForm } from "./new-risk-form";

export default async function NewRiskAssessmentPage() {
  const user = await requirePermission("risk-doc:create");
  const vessels = await listVesselOptions(user.companyId);
  const isShipboard = user.department === "SHIPBOARD";
  const ownVesselName = vessels.find((v) => v.id === user.vesselId)?.name ?? null;
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="New Risk Assessment"
        description="Create a controlled Risk Assessment document. It starts as a draft — submit it for approval once ready."
      />
      <NewRiskAssessmentForm
        vessels={vessels}
        isShipboard={isShipboard}
        ownVesselId={user.vesselId}
        ownVesselName={ownVesselName}
      />
    </div>
  );
}
