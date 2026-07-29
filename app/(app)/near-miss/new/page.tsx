import { requirePermission } from "@/lib/rbac";
import { listVesselOptions } from "@/features/near-miss/queries";
import { PageHeader } from "@/components/ui/page-header";
import { NewNearMissForm } from "./new-near-miss-form";

export default async function NewNearMissPage() {
  const user = await requirePermission("nm:create");
  const vessels = await listVesselOptions(user.companyId);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Report Near Miss"
        description="No one was hurt — but capture what could have happened so it never does."
      />
      <NewNearMissForm vessels={vessels} />
    </div>
  );
}
