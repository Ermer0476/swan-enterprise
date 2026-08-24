import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/rbac";
import { listSireSchedule } from "@/features/sire/queries";
import { SIRE_SCHEDULE_MONTHS, SIRE_VALIDITY_MONTHS, SIRE_SCHEDULE_URGENCY_LABELS } from "@/features/sire/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { SireScheduleUrgency } from "@/features/sire/schema";

function urgencyTone(u: SireScheduleUrgency): "neutral" | "accent" | "success" | "danger" | "warning" {
  switch (u) {
    case "NOT_YET_INSPECTED":
    case "OVERDUE":
      return "danger";
    case "DUE_SOON":
      return "warning";
    case "ON_TRACK":
      return "success";
  }
}

export default async function SireSchedulePage() {
  const user = await requirePermission("sire:read");
  const rows = await listSireSchedule(user.companyId);

  return (
    <>
      <Link href="/sire" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to SIRE Inspections
      </Link>
      <PageHeader
        title="SIRE Schedule"
        description={`Fleet-wide next-inspection matrix — the next SIRE is scheduled ${SIRE_SCHEDULE_MONTHS} months after the last one (reports are valid ${SIRE_VALIDITY_MONTHS} months; the extra month is buffer so validity never lapses).`}
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Vessel</th>
                <th className="px-4 py-2.5 font-medium">Last SIRE</th>
                <th className="px-4 py-2.5 font-medium">Ref</th>
                <th className="px-4 py-2.5 font-medium">Next SIRE Due</th>
                <th className="px-4 py-2.5 font-medium">Validity Expires</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.vesselId} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">{r.vesselName}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {r.lastInspectionDate ? formatDate(r.lastInspectionDate) : "—"}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                    {r.lastInspectionRefNo ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                    {r.scheduledDue ? formatDate(r.scheduledDue) : "—"}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                    {r.validityExpires ? formatDate(r.validityExpires) : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone={urgencyTone(r.urgency)}>{SIRE_SCHEDULE_URGENCY_LABELS[r.urgency]}</Badge>
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
