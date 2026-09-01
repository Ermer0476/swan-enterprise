import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/rbac";
import { getVessel } from "@/features/vessels/queries";
import { listStoresCatalogue, listSparesCatalogue, getOpeningStockTake, listInventoryLedger, listKnownLocations } from "@/features/procurement/queries";
import { STORES_CATEGORY_LABELS } from "@/features/procurement/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StockTakeForm } from "./stock-take-form";

export default async function OpeningStockTakePage({ params }: { params: Promise<{ vesselId: string }> }) {
  const user = await requirePermission("procurement:opening-stock-take");
  const { vesselId } = await params;
  const vessel = await getVessel(user.companyId, vesselId);
  if (!vessel) notFound();

  const stockTake = await getOpeningStockTake(user.companyId, vesselId);

  if (stockTake?.status === "POSTED") {
    const events = (await listInventoryLedger(user.companyId, vesselId)).filter((e) => e.eventType === "OPENING");
    return (
      <div className="mx-auto max-w-3xl">
        <Link href={`/procurement/${vesselId}`} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          ← Back to {vessel.name}
        </Link>
        <PageHeader title={`${vessel.name} — Opening Stock Take`} description="Posted — this vessel's Requisition module is unlocked." />
        <Card>
          <CardContent className="pt-5">
            <div className="mb-3 flex items-center gap-2">
              <Badge tone="success">Posted</Badge>
              <span className="text-sm text-muted-foreground">
                {stockTake.postedAt?.toLocaleDateString()} · {events.length} line{events.length === 1 ? "" : "s"} counted
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [storesItems, sparesItems, knownLocations] = await Promise.all([
    listStoresCatalogue(user.companyId, vesselId),
    listSparesCatalogue(user.companyId, vesselId),
    listKnownLocations(user.companyId, vesselId),
  ]);

  // Stores items carry their own location note during the count (two
  // vessels' "Box No. 3" hold different things, so there's no catalogue-wide
  // location to fall back on). Spares is already per-vessel, so its
  // catalogue location is used as-is. Department (Deck/Engine) is Stores-only
  // for now — Spares doesn't split as cleanly by department, so those rows
  // group under their own "Spares" section instead.
  const rows = [
    ...storesItems.map((i) => ({
      itemType: "STORES" as const,
      itemId: i.id,
      label: `${i.name}${i.impaCode ? ` (${i.impaCode})` : ""}`,
      unit: i.unit,
      department: i.department,
      groupLabel: `${STORES_CATEGORY_LABELS[i.category]}${i.subGroup ? ` — ${i.subGroup}` : ""}`,
      location: null as string | null,
      locationEditable: true,
    })),
    ...sparesItems.map((i) => ({
      itemType: "SPARES" as const,
      itemId: i.id,
      label: `${i.equipmentName} — ${i.makerName} ${i.partNo}`,
      unit: i.unit,
      department: null,
      groupLabel: i.location ?? "Unassigned Location",
      location: i.location,
      locationEditable: false,
    })),
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/procurement/${vesselId}`} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        ← Back to {vessel.name}
      </Link>
      <PageHeader
        title={`${vessel.name} — Opening Stock Take`}
        description="Count what's actually on board today. This is a one-time gate — the Requisition module stays locked until it's posted."
      />
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No catalogue items yet — add Stores and Spares catalogue items first.</p>
      ) : (
        <StockTakeForm vesselId={vesselId} rows={rows} knownLocations={knownLocations} />
      )}
    </div>
  );
}
