import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/rbac";
import { getVessel } from "@/features/vessels/queries";
import { listRequisitionsForVessel, hasPostedOpeningStockTake } from "@/features/procurement/queries";
import { REQUISITION_REVISION_STATUS_LABELS, REQUISITION_DEPARTMENT_LABELS, REQUISITION_CATEGORY_LABELS } from "@/features/procurement/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STATUS_TONE: Record<string, "neutral" | "warning" | "success" | "accent" | "danger"> = {
  DRAFT: "neutral",
  PENDING_MASTER_APPROVAL: "warning",
  APPROVED_BY_MASTER: "success",
  SENT_TO_OFFICE: "accent",
  FOR_QUOTATION: "warning",
  FOR_DELIVERY: "accent",
  RECEIVED: "success",
  CLOSED: "danger",
};

export default async function RequisitionsListPage({ params }: { params: Promise<{ vesselId: string }> }) {
  const user = await requirePermission("procurement:read");
  const { vesselId } = await params;
  const vessel = await getVessel(user.companyId, vesselId);
  if (!vessel) notFound();

  const gated = !(await hasPostedOpeningStockTake(user.companyId, vesselId));
  const requisitions = gated ? [] : await listRequisitionsForVessel(user.companyId, vesselId);
  const canCreate = can(user, "procurement:create");

  return (
    <div className="mx-auto max-w-5xl">
      <Link href={`/procurement/${vesselId}`} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        ← Back to {vessel.name}
      </Link>
      <PageHeader
        title={`${vessel.name} — Requisitions`}
        actions={
          !gated && canCreate ? (
            <Link href={`/procurement/${vesselId}/requisitions/new`}>
              <Button type="button">+ New Requisition</Button>
            </Link>
          ) : undefined
        }
      />

      {gated ? (
        <p className="text-sm text-warning">Post the Opening Stock Take before creating requisitions.</p>
      ) : (
        <Card>
          <CardContent className="pt-5">
            <div className="mb-3 text-sm font-semibold">{requisitions.length} requisition{requisitions.length === 1 ? "" : "s"}</div>
            {requisitions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No requisitions yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Ref No.</th>
                      <th className="px-3 py-2 font-medium">Department</th>
                      <th className="px-3 py-2 font-medium">Category</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Lines</th>
                      <th className="px-3 py-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {requisitions.map((r) => (
                      <tr key={r.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 font-mono text-xs">{r.refNo ?? <span className="italic text-muted-foreground">Draft — not yet numbered</span>}</td>
                        <td className="px-3 py-2 text-muted-foreground">{REQUISITION_DEPARTMENT_LABELS[r.department]}</td>
                        <td className="px-3 py-2 text-muted-foreground">{REQUISITION_CATEGORY_LABELS[r.category]}</td>
                        <td className="px-3 py-2">
                          {r.currentRevision && <Badge tone={STATUS_TONE[r.currentRevision.status] ?? "neutral"}>{REQUISITION_REVISION_STATUS_LABELS[r.currentRevision.status]}</Badge>}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{r.currentRevision?.lines.length ?? 0}</td>
                        <td className="px-3 py-2 text-right">
                          <Link href={`/procurement/${vesselId}/requisitions/${r.id}`}>
                            <Button type="button" variant="outline" size="sm">
                              Open
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
