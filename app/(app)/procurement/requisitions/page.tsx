import Link from "next/link";
import { requirePermission } from "@/lib/rbac";
import { listSentToOfficeRequisitions } from "@/features/procurement/queries";
import { REQUISITION_CATEGORY_LABELS, REQUISITION_DEPARTMENT_LABELS, REQUISITION_REVISION_STATUS_LABELS } from "@/features/procurement/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

const STATUS_TONE: Record<string, "neutral" | "warning" | "success" | "accent" | "danger"> = {
  SENT_TO_OFFICE: "accent",
  FOR_QUOTATION: "warning",
  FOR_DELIVERY: "accent",
};

/** Fleet-wide office inbox — every requisition still in play at the office
 * (screening, out for quotation, or awaiting delivery), across every vessel.
 * Not vessel-scoped, unlike the rest of the Procurement module — office
 * staff shouldn't have to visit every vessel's own page to find what's
 * pending. Drops off once RECEIVED (terminal). */
export default async function OfficeRequisitionsPage() {
  const user = await requirePermission("procurement:office-review");
  const requisitions = await listSentToOfficeRequisitions(user.companyId);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Requisitions — Office Review" description="Sent in by vessel Masters, awaiting office screening." />

      <Card>
        <CardContent className="pt-5">
          <div className="mb-3 text-sm font-semibold">{requisitions.length} in progress</div>
          {requisitions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing waiting on the office right now.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Vessel</th>
                    <th className="px-3 py-2 font-medium">Ref No.</th>
                    <th className="px-3 py-2 font-medium">Department</th>
                    <th className="px-3 py-2 font-medium">Category</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Requested By</th>
                    <th className="px-3 py-2 font-medium">Sent</th>
                    <th className="px-3 py-2 font-medium">Lines</th>
                    <th className="px-3 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {requisitions.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 font-medium">{r.vesselName}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.refNo ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{REQUISITION_DEPARTMENT_LABELS[r.department]}</td>
                      <td className="px-3 py-2 text-muted-foreground">{REQUISITION_CATEGORY_LABELS[r.category]}</td>
                      <td className="px-3 py-2">
                        <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{REQUISITION_REVISION_STATUS_LABELS[r.status]}</Badge>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{r.requestedBy ?? "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{r.sentToOfficeAt ? formatDate(r.sentToOfficeAt) : "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {r.lineCount}
                        {r.cancelledCount > 0 && (
                          <Badge tone="danger" className="ml-2">
                            {r.cancelledCount} cancelled
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link href={`/procurement/${r.vesselId}/requisitions/${r.id}`} className="text-xs font-medium text-accent hover:underline">
                          Review
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
    </div>
  );
}
