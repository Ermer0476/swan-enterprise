import { requirePermission } from "@/lib/rbac";
import { listVesselOptions } from "@/features/drills/queries";
import { PageHeader } from "@/components/ui/page-header";
import { NewDrillForm } from "./new-drill-form";

export default async function NewDrillPage() {
  const user = await requirePermission("drill:create");
  const vessels = await listVesselOptions(user.companyId);
  const isShipboard = user.department === "SHIPBOARD";
  const ownVesselName = vessels.find((v) => v.id === user.vesselId)?.name ?? null;
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Record Emergency Drill"
        description="Log a fire, abandon ship, man overboard, or other emergency drill."
      />
      <NewDrillForm
        vessels={vessels}
        isShipboard={isShipboard}
        ownVesselId={user.vesselId}
        ownVesselName={ownVesselName}
      />
    </div>
  );
}
