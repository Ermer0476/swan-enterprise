import { requirePermission } from "@/lib/rbac";
import { getRiskScaleLabels } from "@/features/risk/queries";
import { PageHeader } from "@/components/ui/page-header";
import { NewRiskAssessmentForm } from "./new-risk-form";

export default async function NewRiskAssessmentPage() {
  const user = await requirePermission("risk-doc:create");
  const scaleLabels = await getRiskScaleLabels(user.companyId);
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="New Risk Assessment"
        description="Create a controlled Risk Assessment document. It starts as a draft — submit it for approval once ready."
      />
      <NewRiskAssessmentForm scaleLabels={scaleLabels} />
    </div>
  );
}
