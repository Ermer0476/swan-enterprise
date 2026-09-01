import { requirePermission } from "@/lib/rbac";
import { listVesselOptions } from "@/features/drills/queries";
import { listLsaFfeCatalog } from "@/features/crew-familiarization/queries";
import { PageHeader } from "@/components/ui/page-header";
import { StartFamiliarizationForm } from "./start-familiarization-form";

export default async function NewCrewFamiliarizationPage() {
  const user = await requirePermission("drill:create");
  const [vessels, catalog] = await Promise.all([
    listVesselOptions(user.companyId),
    listLsaFfeCatalog(user.companyId),
  ]);
  const isShipboard = user.department === "SHIPBOARD";
  const ownVesselName = vessels.find((v) => v.id === user.vesselId)?.name ?? null;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="New LSA/FFE Familiarization"
        description="Pick the vessel, who attended, the week you're logging, and tick the items covered — the record is created only once you save."
      />
      <StartFamiliarizationForm
        vessels={vessels}
        catalog={catalog}
        isShipboard={isShipboard}
        ownVesselId={user.vesselId}
        ownVesselName={ownVesselName}
        today={new Date().toISOString().slice(0, 10)}
      />
    </div>
  );
}
