import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { getVessel } from "@/features/vessels/queries";
import { updateVesselAction, deleteVesselAction } from "@/features/vessels/actions";
import { humanize } from "@/features/vessels/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VesselForm } from "@/components/vessels/vessel-form";
import { DeleteVesselButton } from "./delete-vessel-button";

export default async function VesselDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("vessel:read");
  const { id } = await params;
  const vessel = await getVessel(user.companyId, id);
  if (!vessel) notFound();

  const canUpdate = can(user, "vessel:update");
  const canDelete = can(user, "vessel:delete");

  const meta = [
    { label: "Official Number", value: vessel.officialNumber ?? "—" },
    { label: "Call Sign", value: vessel.callSign ?? "—" },
    { label: "MMSI", value: vessel.mmsi ?? "—" },
    { label: "Flag State", value: vessel.flag ?? "—" },
    { label: "Classification Society", value: vessel.classificationSociety ?? "—" },
    { label: "Year Built", value: vessel.yearBuilt ?? "—" },
    { label: "Gross Tonnage", value: vessel.grossTonnage ?? "—" },
    {
      label: "LOA / Breadth / Depth (m)",
      value: `${vessel.loa ?? "—"} / ${vessel.breadth ?? "—"} / ${vessel.depth ?? "—"}`,
    },
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/vessels"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Vessels
      </Link>

      <PageHeader
        title={`${vessel.name} — IMO ${vessel.imo}`}
        actions={<Badge tone={vessel.status === "ACTIVE" ? "success" : "warning"}>{humanize(vessel.status)}</Badge>}
      />

      {!canUpdate && (
        <Card className="mb-6">
          <CardContent className="grid grid-cols-2 gap-4 pt-5 sm:grid-cols-3">
            {meta.map((m) => (
              <div key={m.label}>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{m.label}</div>
                <div className="mt-0.5 text-sm font-medium">{m.value}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {canUpdate && (
        <VesselForm
          action={updateVesselAction}
          submitLabel="Save changes"
          pendingLabel="Saving…"
          values={{
            id: vessel.id,
            name: vessel.name,
            imo: vessel.imo,
            officialNumber: vessel.officialNumber ?? "",
            callSign: vessel.callSign ?? "",
            mmsi: vessel.mmsi ?? "",
            flag: vessel.flag ?? "",
            type: vessel.type,
            classificationSociety: vessel.classificationSociety ?? "",
            yearBuilt: vessel.yearBuilt?.toString() ?? "",
            grossTonnage: vessel.grossTonnage?.toString() ?? "",
            loa: vessel.loa?.toString() ?? "",
            breadth: vessel.breadth?.toString() ?? "",
            depth: vessel.depth?.toString() ?? "",
            status: vessel.status,
          }}
        />
      )}

      {canDelete && (
        <div className="mt-4">
          <DeleteVesselButton vesselId={vessel.id} action={deleteVesselAction} />
        </div>
      )}
    </div>
  );
}
