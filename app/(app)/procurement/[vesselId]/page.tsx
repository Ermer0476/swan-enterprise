import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/rbac";
import { getVessel } from "@/features/vessels/queries";
import { hasPostedOpeningStockTake, listRequisitionsForVessel } from "@/features/procurement/queries";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function VesselProcurementHubPage({ params }: { params: Promise<{ vesselId: string }> }) {
  const user = await requirePermission("procurement:read");
  const { vesselId } = await params;
  const vessel = await getVessel(user.companyId, vesselId);
  if (!vessel) notFound();

  const posted = await hasPostedOpeningStockTake(user.companyId, vesselId);
  const requisitions = posted ? await listRequisitionsForVessel(user.companyId, vesselId) : [];

  return (
    <div className="mx-auto max-w-3xl">
      {user.department !== "SHIPBOARD" && (
        <Link href="/procurement" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          ← Back to Fleet
        </Link>
      )}
      <PageHeader
        title={`${vessel.name} — Procurement`}
        description={posted ? "Opening Stock Take posted — Requisitions and Inventory are unlocked." : "Opening Stock Take not yet posted."}
      />

      {!posted && (
        <Card className="mb-4 border-warning/40">
          <CardContent className="flex items-center justify-between gap-3 pt-5">
            <div>
              <p className="text-sm font-medium">This vessel's Requisition module is locked.</p>
              <p className="text-sm text-muted-foreground">Post a physical Opening Stock Take first — it becomes the vessel's opening inventory balance.</p>
            </div>
            <Link href={`/procurement/${vesselId}/opening-stock-take`}>
              <Button type="button">Post Opening Stock Take</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href={`/procurement/${vesselId}/inventory`}>
          <Card className={!posted ? "opacity-60" : undefined}>
            <CardContent className="pt-5">
              <div className="text-sm font-semibold">Inventory Ledger</div>
              <p className="mt-1 text-sm text-muted-foreground">Event log + computed ROB per item.</p>
            </CardContent>
          </Card>
        </Link>
        <Link href={posted ? `/procurement/${vesselId}/requisitions` : "#"}>
          <Card className={!posted ? "opacity-60" : undefined}>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Requisitions</div>
                {posted && <Badge tone="neutral">{requisitions.length}</Badge>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">Draft, approve, and track stores/spares requests.</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
