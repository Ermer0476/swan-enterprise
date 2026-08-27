import { requirePermission } from "@/lib/rbac";
import { listVesselOptions } from "@/features/near-miss/queries";
import { getReporterPositionOptions, getRootCauseSubcategoryOptions } from "@/lib/reference-list";
import { PageHeader } from "@/components/ui/page-header";
import { NewNearMissForm } from "./new-near-miss-form";

export default async function NewNearMissPage() {
  const user = await requirePermission("nm:create");
  const vessels = await listVesselOptions(user.companyId);
  const positions = await getReporterPositionOptions(user.companyId, user.department);
  const subcategoryOptions = await getRootCauseSubcategoryOptions(user.companyId);
  const isShipboard = user.department === "SHIPBOARD";
  const ownVesselName = vessels.find((v) => v.id === user.vesselId)?.name ?? null;
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Report Near Miss/HOR"
        description="No one was hurt — but capture what could have happened, or what unsafe act/condition you observed, so it never does."
      />
      <NewNearMissForm
        vessels={vessels}
        positions={positions}
        subcategoryOptions={subcategoryOptions}
        isShipboard={isShipboard}
        ownVesselId={user.vesselId}
        ownVesselName={ownVesselName}
      />
    </div>
  );
}
