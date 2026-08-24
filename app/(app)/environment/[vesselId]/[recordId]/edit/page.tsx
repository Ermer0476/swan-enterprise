import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/rbac";
import { getEnvironmentRecord } from "@/features/environment/queries";
import { updateEnvironmentRecordAction } from "@/features/environment/actions";
import { listUnitMasters } from "@/features/environment/queries";
import { GARBAGE_CATEGORIES, MONTH_NAMES, type GarbageCategoryValue } from "@/features/environment/schema";
import { PageHeader } from "@/components/ui/page-header";
import { EnvironmentRecordForm, type EnvironmentRecordDefaults } from "../../environment-record-form";

function n(v: number | null | undefined): string {
  return v?.toString() ?? "";
}

export default async function EditEnvironmentRecordPage({ params }: { params: Promise<{ vesselId: string; recordId: string }> }) {
  const user = await requirePermission("environment:update");
  const { vesselId, recordId } = await params;
  const [record, sewageUnits, cargoUnits] = await Promise.all([
    getEnvironmentRecord(user.companyId, recordId),
    listUnitMasters(user.companyId, "SEWAGE"),
    listUnitMasters(user.companyId, "CARGO"),
  ]);
  if (!record || record.vesselId !== vesselId) notFound();

  const byCategory = new Map(record.garbageEntries.map((e) => [e.category, e]));
  const garbage = Object.fromEntries(
    GARBAGE_CATEGORIES.map((c) => {
      const entry = byCategory.get(c);
      return [
        c,
        {
          overboard: entry?.overboardToSeaCbm?.toString() ?? "",
          incinerated: entry?.incineratedCbm?.toString() ?? "",
          ashore: entry?.dischargeAshoreCbm?.toString() ?? "",
        },
      ];
    }),
  ) as Record<GarbageCategoryValue, { overboard: string; incinerated: string; ashore: string }>;

  const defaults: EnvironmentRecordDefaults = {
    recordId: record.id,
    year: String(record.year),
    month: String(record.month),

    ballastWaterQuantity: n(record.ballastWaterQuantity),
    ballastWaterOperations: n(record.ballastWaterOperations),
    ballastWaterMethod: record.ballastWaterMethod ?? "",
    ballastWaterRemarks: record.ballastWaterRemarks ?? "",

    sewageDischargedAtSea: n(record.sewageDischargedAtSea),
    sewageDischargedToFacility: n(record.sewageDischargedToFacility),
    sewageUnit: record.sewageUnit ?? "",
    sewageReceptionFacility: record.sewageReceptionFacility ?? "",
    sewageRemarks: record.sewageRemarks ?? "",

    greyWaterGenerated: n(record.greyWaterGenerated),
    greyWaterDischarged: n(record.greyWaterDischarged),
    greyWaterRetained: n(record.greyWaterRetained),
    greyWaterRemarks: record.greyWaterRemarks ?? "",

    refrigerantGasType: record.refrigerantGasType ?? "",
    refrigerantEquipment: record.refrigerantEquipment ?? "",
    refrigerantAdded: n(record.refrigerantAdded),
    refrigerantRecovered: n(record.refrigerantRecovered),
    refrigerantDisposedAshore: n(record.refrigerantDisposedAshore),
    refrigerantLeakage: n(record.refrigerantLeakage),
    refrigerantQuantityKg: n(record.refrigerantQuantityKg),
    refrigerantRemarks: record.refrigerantRemarks ?? "",

    cargoLoaded: n(record.cargoLoaded),
    cargoDischarged: n(record.cargoDischarged),
    cargoType: record.cargoType ?? "",
    cargoUnit: record.cargoUnit ?? "",
    cargoPort: record.cargoPort ?? "",

    lubeOilType: record.lubeOilType ?? "",
    lubeOilAdded: n(record.lubeOilAdded),
    lubeOilTransferred: n(record.lubeOilTransferred),
    lubeOilLost: n(record.lubeOilLost),
    lubeOilEquipment: record.lubeOilEquipment ?? "",
    lubeOilRemarks: record.lubeOilRemarks ?? "",

    bilgeGenerated: n(record.bilgeGenerated),
    bilgeProcessed: n(record.bilgeProcessed),
    bilgeDischargedOws: n(record.bilgeDischargedOws),
    bilgeLandedAshore: n(record.bilgeLandedAshore),
    bilgeRetained: n(record.bilgeRetained),
    bilgeRemarks: record.bilgeRemarks ?? "",

    sludgeGenerated: n(record.sludgeGenerated),
    sludgeRetained: n(record.sludgeRetained),
    sludgeTransferredIncinerator: n(record.sludgeTransferredIncinerator),
    sludgeLandedAshore: n(record.sludgeLandedAshore),
    sludgeRemarks: record.sludgeRemarks ?? "",

    garbage,
  };

  return (
    <div className="mx-auto max-w-5xl">
      <Link href={`/environment/${vesselId}`} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to {record.vessel.name} — Environment Records
      </Link>
      <PageHeader
        title={`${record.vessel.name} — Edit Environment Record`}
        description={`${MONTH_NAMES[record.month - 1]} ${record.year}`}
      />
      <EnvironmentRecordForm
        action={updateEnvironmentRecordAction}
        vesselId={vesselId}
        defaults={defaults}
        sewageUnitOptions={sewageUnits}
        cargoUnitOptions={cargoUnits}
        submitLabel="Save Changes"
        pendingLabel="Saving…"
      />
    </div>
  );
}
