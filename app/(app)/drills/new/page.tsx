import { requirePermission } from "@/lib/rbac";
import { listVesselOptions } from "@/features/drills/queries";
import { PageHeader } from "@/components/ui/page-header";
import { NewDrillForm } from "./new-drill-form";

export default async function NewDrillPage() {
  const user = await requirePermission("drill:create");
  const vessels = await listVesselOptions(user.companyId);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Record Emergency Drill"
        description="Log a fire, abandon ship, man overboard, or other emergency drill."
      />
      <NewDrillForm vessels={vessels} />
    </div>
  );
}
