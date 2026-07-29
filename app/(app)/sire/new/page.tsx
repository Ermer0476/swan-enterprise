import { requirePermission } from "@/lib/rbac";
import { listVesselOptions } from "@/features/sire/queries";
import { PageHeader } from "@/components/ui/page-header";
import { NewSireForm } from "./new-sire-form";

export default async function NewSirePage() {
  const user = await requirePermission("sire:create");
  const vessels = await listVesselOptions(user.companyId);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Record SIRE Inspection"
        description="Create the inspection header, then log observations on the detail page."
      />
      <NewSireForm vessels={vessels} />
    </div>
  );
}
