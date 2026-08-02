import { requirePermission } from "@/lib/rbac";
import { listVesselOptions, listOfficeUserOptions } from "@/features/circulars/queries";
import { PageHeader } from "@/components/ui/page-header";
import { NewCircularForm } from "./new-circular-form";

export default async function NewCircularPage() {
  const user = await requirePermission("circular:create");
  const [vessels, officeUsers] = await Promise.all([
    listVesselOptions(user.companyId),
    listOfficeUserOptions(user.companyId),
  ]);
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Issue Circular"
        description="Notify the fleet, or a specific vessel, of a safety, technical, navigational, security, operational, HR, or regulatory matter — from the Flag, Class, Insurance, or the Company itself."
      />
      <NewCircularForm vessels={vessels} officeUsers={officeUsers} />
    </div>
  );
}
