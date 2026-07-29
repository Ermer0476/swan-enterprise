import { requirePermission } from "@/lib/rbac";
import { listVesselOptions } from "@/features/non-conformities/queries";
import { PageHeader } from "@/components/ui/page-header";
import { NewNcrForm } from "./new-ncr-form";

export default async function NewNcrPage() {
  const user = await requirePermission("ncr:create");
  const vessels = await listVesselOptions(user.companyId);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Raise Non-Conformity"
        description="Record a finding where an SMS clause, regulation or standard is not met."
      />
      <NewNcrForm vessels={vessels} />
    </div>
  );
}
