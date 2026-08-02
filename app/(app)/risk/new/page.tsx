import { requirePermission } from "@/lib/rbac";
import { listVesselOptions } from "@/features/risk/queries";
import { PageHeader } from "@/components/ui/page-header";
import { NewRiskAssessmentForm } from "./new-risk-form";

export default async function NewRiskAssessmentPage() {
  const user = await requirePermission("risk:create");
  const vessels = await listVesselOptions(user.companyId);
  const isShipboard = user.department === "SHIPBOARD";
  const ownVesselName = vessels.find((v) => v.id === user.vesselId)?.name ?? null;
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="New Risk Assessment"
        description="Assess the hazards, controls, and likelihood × severity of a task or operation."
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
