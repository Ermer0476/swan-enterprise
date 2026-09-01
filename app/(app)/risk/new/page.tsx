import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { NewRiskAssessmentForm } from "./new-risk-form";

export default async function NewRiskAssessmentPage() {
  await requirePermission("risk-doc:create");
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="New Risk Assessment"
        description="Create a controlled Risk Assessment document. It starts as a draft — submit it for approval once ready."
      />
      <NewRiskAssessmentForm />
    </div>
  );
}
