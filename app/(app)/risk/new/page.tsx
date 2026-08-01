import { requirePermission } from "@/lib/rbac";
import { listVesselOptions } from "@/features/risk/queries";
import { PageHeader } from "@/components/ui/page-header";
import { NewRiskAssessmentForm } from "./new-risk-form";

export default async function NewRiskAssessmentPage() {
  const user = await requirePermission("risk:create");
  const vessels = await listVesselOptions(user.companyId);
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="New Risk Assessment"
        description="Assess the hazards, controls, and likelihood × severity of a task or operation."
      />
      <NewRiskAssessmentForm vessels={vessels} />
    </div>
  );
}
