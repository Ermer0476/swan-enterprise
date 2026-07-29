import { requirePermission } from "@/lib/rbac";
import { listVesselOptions } from "@/features/cdi/queries";
import { PageHeader } from "@/components/ui/page-header";
import { NewCdiForm } from "./new-cdi-form";

export default async function NewCdiPage() {
  const user = await requirePermission("cdi:create");
  const vessels = await listVesselOptions(user.companyId);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Record CDI Inspection"
        description="Create the inspection header, then log observations on the detail page."
      />
      <NewCdiForm vessels={vessels} />
    </div>
  );
}
