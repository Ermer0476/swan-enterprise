import { requirePermission } from "@/lib/rbac";
import { listVesselOptions } from "@/features/drills/queries";
import { resolveEffectiveScheduleItems } from "@/features/schedule/queries";
import { PageHeader } from "@/components/ui/page-header";
import { NewDrillForm } from "./new-drill-form";

export default async function NewDrillPage() {
  const user = await requirePermission("drill:create");
  const vessels = await listVesselOptions(user.companyId);
  const isShipboard = user.department === "SHIPBOARD";
  const ownVessel = vessels.find((v) => v.id === user.vesselId) ?? null;

  // Different flags require different drills — since the office form lets
  // the reporter pick any vessel, resolve every distinct flag's own set up
  // front (plus "" the default) so the client can switch instantly when the
  // vessel selection changes, no reload needed. Shipboard's own vessel/flag
  // is fixed, so this degenerates to a single flag anyway.
  const distinctFlags = Array.from(new Set(vessels.map((v) => v.flag).filter((f): f is string => !!f)));
  const itemsByFlag: Record<string, Awaited<ReturnType<typeof resolveEffectiveScheduleItems>>> = {};
  await Promise.all(
    [...distinctFlags, ""].map(async (flag) => {
      itemsByFlag[flag] = await resolveEffectiveScheduleItems(user.companyId, "DRILL", flag || null);
    }),
  );

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Record Emergency Drill"
        description="Log which SMS drill item (A-EMP-01) was conducted."
      />
      <NewDrillForm
        vessels={vessels}
        itemsByFlag={itemsByFlag}
        isShipboard={isShipboard}
        ownVesselId={user.vesselId}
        ownVesselName={ownVessel?.name ?? null}
        ownVesselFlag={ownVessel?.flag ?? null}
      />
    </div>
  );
}
