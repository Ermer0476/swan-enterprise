import { requirePermission } from "@/lib/rbac";
import { listVesselOptions } from "@/features/drills/queries";
import { listScheduleItems } from "@/features/schedule/queries";
import { PageHeader } from "@/components/ui/page-header";
import { NewDrillForm } from "./new-drill-form";

export default async function NewDrillPage() {
  const user = await requirePermission("drill:create");
  const vessels = await listVesselOptions(user.companyId);
  const scheduleItems = await listScheduleItems(user.companyId, "DRILL");
  const isShipboard = user.department === "SHIPBOARD";
  const ownVesselName = vessels.find((v) => v.id === user.vesselId)?.name ?? null;
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Record Emergency Drill"
        description="Log which SMS drill item (A-EMP-01) was conducted."
      />
      <NewDrillForm
        vessels={vessels}
        scheduleItems={scheduleItems}
        isShipboard={isShipboard}
        ownVesselId={user.vesselId}
        ownVesselName={ownVesselName}
      />
    </div>
  );
}
