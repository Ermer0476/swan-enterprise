import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePermission, can } from "@/lib/rbac";
import { listFleetProcurementStatus } from "@/features/procurement/queries";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

// Inventory should get touched (a count, an issue, an adjustment) at least
// this often — past it, the ROB figures are more likely to have drifted
// from what's actually on board.
const STALE_INVENTORY_DAYS = 90;

export default async function ProcurementFleetPage() {
  const user = await requirePermission("procurement:read");

  // Shipboard users only ever see their own vessel — skip straight to its
  // hub (Inventory + Requisitions) instead of the office-facing fleet list.
  if (user.department === "SHIPBOARD" && user.vesselId) {
    redirect(`/procurement/${user.vesselId}`);
  }

  const fleet = await listFleetProcurementStatus(user.companyId);
  const canManageCatalogue = can(user, "procurement:manage-catalogue");
  const canOfficeReview = can(user, "procurement:office-review");
  const totalPending = fleet.reduce((sum, f) => sum + f.pendingRequisitionCount, 0);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Procurement"
        description="Item Master, Opening Stock Take, Inventory, and Requisitions."
        actions={
          canManageCatalogue || canOfficeReview ? (
            <div className="flex gap-2">
              {canOfficeReview && (
                <Link href="/procurement/requisitions">
                  <Button type="button">
                    Requisitions Awaiting Office Review{totalPending > 0 ? ` (${totalPending})` : ""}
                  </Button>
                </Link>
              )}
              {canManageCatalogue && (
                <>
                  <Link href="/procurement/catalogue/stores">
                    <Button type="button" variant="outline">
                      Stores Catalogue
                    </Button>
                  </Link>
                  <Link href="/procurement/catalogue/spares">
                    <Button type="button" variant="outline">
                      Spares Catalogue
                    </Button>
                  </Link>
                </>
              )}
            </div>
          ) : undefined
        }
      />

      <Card>
        <CardContent className="pt-5">
          <div className="mb-3 text-sm font-semibold">Fleet — {fleet.length} vessels</div>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Vessel</th>
                  <th className="px-3 py-2 font-medium">Opening Stock Take</th>
                  <th className="px-3 py-2 font-medium">Last Inventory Update</th>
                  <th className="px-3 py-2 font-medium">Pending Requisitions</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {fleet.map(({ vessel, stockTakeStatus, pendingRequisitionCount, lastInventoryUpdate }) => {
                  const posted = stockTakeStatus === "POSTED";
                  const daysSinceUpdate = lastInventoryUpdate ? Math.floor((Date.now() - lastInventoryUpdate.getTime()) / 86_400_000) : null;
                  const stale = daysSinceUpdate !== null && daysSinceUpdate > STALE_INVENTORY_DAYS;
                  return (
                    <tr key={vessel.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 font-medium">{vessel.name}</td>
                      <td className="px-3 py-2">
                        {posted ? (
                          <Badge tone="success">Posted</Badge>
                        ) : stockTakeStatus === "DRAFT" ? (
                          <Badge tone="warning">Draft</Badge>
                        ) : (
                          <Badge tone="neutral">Not started</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {lastInventoryUpdate ? (
                          <div className="flex items-center gap-1.5">
                            <span className={stale ? "text-danger" : "text-muted-foreground"}>{formatDate(lastInventoryUpdate)}</span>
                            {stale && <Badge tone="danger">3+ months</Badge>}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {pendingRequisitionCount > 0 ? (
                          <Badge tone="warning">{pendingRequisitionCount} pending</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link href={`/procurement/${vessel.id}`}>
                          <Button type="button" variant="outline" size="sm">
                            Open Vessel
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
