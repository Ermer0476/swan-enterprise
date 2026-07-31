import { requirePermission } from "@/lib/rbac";
import { listVesselOptions } from "@/features/defects/queries";
import { PageHeader } from "@/components/ui/page-header";
import { NewDefectForm } from "./new-defect-form";

export default async function NewDefectPage() {
  const user = await requirePermission("defect:create");
  const vessels = await listVesselOptions(user.companyId);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Report Defect"
        description="Log an equipment or machinery defect for tracking to rectification."
      />
      <NewDefectForm vessels={vessels} />
    </div>
  );
}
