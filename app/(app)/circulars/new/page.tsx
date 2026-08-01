import { requirePermission } from "@/lib/rbac";
import { listVesselOptions } from "@/features/circulars/queries";
import { PageHeader } from "@/components/ui/page-header";
import { NewCircularForm } from "./new-circular-form";

export default async function NewCircularPage() {
  const user = await requirePermission("circular:create");
  const vessels = await listVesselOptions(user.companyId);
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Issue Circular"
        description="Notify the fleet, or a specific vessel, of a safety, technical, operational, HR, or regulatory matter."
      />
      <NewCircularForm vessels={vessels} />
    </div>
  );
}
