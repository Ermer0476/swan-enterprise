import { requirePermission } from "@/lib/rbac";
import { listQuestionnaireVersions } from "@/features/sire-questionnaire/queries";
import { PageHeader } from "@/components/ui/page-header";
import { QuestionnaireManager } from "./questionnaire-manager";

export default async function SireQuestionnairePage() {
  const user = await requirePermission("sire-questionnaire:manage");
  const versions = await listQuestionnaireVersions(user.companyId);

  return (
    <>
      <PageHeader
        title="SIRE 2.0 Questionnaire"
        description="Reference VIQ used to suggest chapter/question numbers on Company Inspection observations. Upload a new version whenever OCIMF revises the questionnaire — the latest upload becomes active immediately."
      />
      <QuestionnaireManager
        versions={versions.map((v) => ({
          id: v.id,
          label: v.label,
          isActive: v.isActive,
          itemCount: v.itemCount,
          createdAt: v.createdAt.toISOString(),
        }))}
      />
    </>
  );
}
