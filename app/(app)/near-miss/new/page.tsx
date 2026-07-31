import { requirePermission } from "@/lib/rbac";
import { listVesselOptions } from "@/features/near-miss/queries";
import { positionsFor } from "@/features/near-miss/schema";
import { PageHeader } from "@/components/ui/page-header";
import { NewNearMissForm } from "./new-near-miss-form";

export default async function NewNearMissPage() {
  const user = await requirePermission("nm:create");
  const vessels = await listVesselOptions(user.companyId);
  const positions = positionsFor(user.department);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Report Near Miss/HOR"
        description="No one was hurt — but capture what could have happened, or what unsafe act/condition you observed, so it never does."
      />
      <NewNearMissForm vessels={vessels} positions={positions} />
    </div>
  );
}
