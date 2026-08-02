import { requirePermission } from "@/lib/rbac";
import { listVesselOptions } from "@/features/cdi/queries";
import { PageHeader } from "@/components/ui/page-header";
import { NewCdiForm } from "./new-cdi-form";

export default async function NewCdiPage() {
  const user = await requirePermission("cdi:create");
  const vessels = await listVesselOptions(user.companyId);
  const isShipboard = user.department === "SHIPBOARD";
  const ownVesselName = vessels.find((v) => v.id === user.vesselId)?.name ?? null;
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Record CDI Inspection"
        description="Create the inspection header, then log observations on the detail page."
      />
      <NewCdiForm
        vessels={vessels}
        isShipboard={isShipboard}
        ownVesselId={user.vesselId}
        ownVesselName={ownVesselName}
      />
    </div>
  );
}
