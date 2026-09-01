import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/rbac";
import { listInternalAuditSchedule } from "@/features/internal-audits/queries";
import { INTERNAL_AUDIT_SCHEDULE_MONTHS, INTERNAL_AUDIT_SCHEDULE_URGENCY_LABELS } from "@/features/internal-audits/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { InternalAuditScheduleUrgency } from "@/features/internal-audits/schema";

function urgencyTone(u: InternalAuditScheduleUrgency): "neutral" | "accent" | "success" | "danger" | "warning" {
  switch (u) {
    case "NOT_YET_AUDITED":
    case "OVERDUE":
      return "danger";
    case "DUE_SOON":
      return "warning";
    case "ON_TRACK":
      return "success";
  }
}

export default async function InternalAuditSchedulePage() {
  const user = await requirePermission("iaudit:read");
  const isShipboard = user.department === "SHIPBOARD";
  const rows = await listInternalAuditSchedule(user.companyId, isShipboard ? (user.vesselId ?? undefined) : undefined);

  return (
    <>
      <Link href="/internal-audits" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Internal Audits
      </Link>
      <PageHeader
        title="Internal Audit Schedule"
        description={`${isShipboard ? "Next-audit matrix" : "Fleet-wide next-audit matrix"} — ISM requires an internal audit of every vessel at least once every ${INTERNAL_AUDIT_SCHEDULE_MONTHS} months.`}
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Vessel</th>
                <th className="px-4 py-2.5 font-medium">Last Internal Audit</th>
                <th className="px-4 py-2.5 font-medium">Ref</th>
                <th className="px-4 py-2.5 font-medium">Next Audit Due</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.vesselId} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">{r.vesselName}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {r.lastAuditDate ? formatDate(r.lastAuditDate) : "—"}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                    {r.lastAuditRefNo ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                    {r.scheduledDue ? formatDate(r.scheduledDue) : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone={urgencyTone(r.urgency)}>{INTERNAL_AUDIT_SCHEDULE_URGENCY_LABELS[r.urgency]}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
