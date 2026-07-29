import { requirePermission } from "@/lib/rbac";
import { listVesselOptions } from "@/features/hazards/queries";
import { PageHeader } from "@/components/ui/page-header";
import { NewHazardForm } from "./new-hazard-form";

export default async function NewHazardPage() {
  const user = await requirePermission("hazard:create");
  const vessels = await listVesselOptions(user.companyId);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Submit Hazard Observation"
        description="Report an unsafe act or condition you observed."
      />
      <NewHazardForm vessels={vessels} />
    </div>
  );
}
