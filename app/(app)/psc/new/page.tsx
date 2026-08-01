import { requirePermission } from "@/lib/rbac";
import { listVesselOptions } from "@/features/psc/queries";
import { PageHeader } from "@/components/ui/page-header";
import { NewPscForm } from "./new-psc-form";

export default async function NewPscPage() {
  const user = await requirePermission("psc:create");
  const vessels = await listVesselOptions(user.companyId);
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Record PSC Inspection"
        description="Create the inspection header, then log deficiencies on the detail page."
      />
      <NewPscForm vessels={vessels} />
    </div>
  );
}
