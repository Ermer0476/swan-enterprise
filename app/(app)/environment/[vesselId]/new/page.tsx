import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/rbac";
import { getVessel } from "@/features/vessels/queries";
import { addEnvironmentRecordAction } from "@/features/environment/actions";
import { listUnitMasters } from "@/features/environment/queries";
import { GARBAGE_CATEGORIES } from "@/features/environment/schema";
import { PageHeader } from "@/components/ui/page-header";
import { EnvironmentRecordForm, type EnvironmentRecordDefaults } from "../environment-record-form";

export default async function NewEnvironmentRecordPage({ params }: { params: Promise<{ vesselId: string }> }) {
  const user = await requirePermission("environment:create");
  const { vesselId } = await params;
  const [vessel, sewageUnits, cargoUnits] = await Promise.all([
    getVessel(user.companyId, vesselId),
    listUnitMasters(user.companyId, "SEWAGE"),
    listUnitMasters(user.companyId, "CARGO"),
  ]);
  if (!vessel) notFound();

  const today = new Date();
  const defaults: EnvironmentRecordDefaults = {
    year: String(today.getUTCFullYear()),
    month: String(today.getUTCMonth() + 1),

    ballastWaterQuantity: "",
    ballastWaterOperations: "",
    ballastWaterMethod: "",
    ballastWaterRemarks: "",

    sewageDischargedAtSea: "",
    sewageDischargedToFacility: "",
    sewageUnit: sewageUnits.find((u) => u.isDefault)?.unit ?? "",
    sewageReceptionFacility: "",
    sewageRemarks: "",

    greyWaterGenerated: "",
    greyWaterDischarged: "",
    greyWaterRetained: "",
    greyWaterRemarks: "",

    refrigerantGasType: "",
    refrigerantEquipment: "",
    refrigerantAdded: "",
    refrigerantRecovered: "",
    refrigerantDisposedAshore: "",
    refrigerantLeakage: "",
    refrigerantQuantityKg: "",
    refrigerantRemarks: "",

    cargoLoaded: "",
    cargoDischarged: "",
    cargoType: "",
    cargoUnit: cargoUnits.find((u) => u.isDefault)?.unit ?? "",
    cargoPort: "",

    lubeOilType: "",
    lubeOilAdded: "",
    lubeOilTransferred: "",
    lubeOilLost: "",
    lubeOilEquipment: "",
    lubeOilRemarks: "",

    bilgeGenerated: "",
    bilgeProcessed: "",
    bilgeDischargedOws: "",
    bilgeLandedAshore: "",
    bilgeRetained: "",
    bilgeRemarks: "",

    sludgeGenerated: "",
    sludgeRetained: "",
    sludgeTransferredIncinerator: "",
    sludgeLandedAshore: "",
    sludgeRemarks: "",

    garbage: Object.fromEntries(GARBAGE_CATEGORIES.map((c) => [c, { overboard: "", incinerated: "", ashore: "" }])) as EnvironmentRecordDefaults["garbage"],
  };

  return (
    <div className="mx-auto max-w-5xl">
      <Link href={`/environment/${vesselId}`} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to {vessel.name} — Environment Records
      </Link>
      <PageHeader title={`${vessel.name} — New Environment Record`} description="Monthly garbage disposal and oil/water discharge report." />
      <EnvironmentRecordForm
        action={addEnvironmentRecordAction}
        vesselId={vesselId}
        defaults={defaults}
        sewageUnitOptions={sewageUnits}
        cargoUnitOptions={cargoUnits}
        submitLabel="Save Record"
        pendingLabel="Saving…"
      />
    </div>
  );
}
