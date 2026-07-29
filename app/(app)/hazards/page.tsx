import Link from "next/link";
import { Plus, Eye } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { listHazards } from "@/features/hazards/queries";
import { HAZARD_STATUSES, SEVERITIES } from "@/features/hazards/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDate, humanize, severityTone } from "@/lib/utils";
import type { HazardStatus, Severity } from "@/lib/generated/prisma";

function statusTone(s: string) {
  return s === "CLOSED" ? "success" : s === "IN_PROGRESS" ? "warning" : "accent";
}

export default async function HazardsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("hazard:read");
  const sp = await searchParams;
  const rows = await listHazards(user.companyId, {
    search: sp.q || undefined,
    status: (sp.status as HazardStatus) || undefined,
    riskLevel: (sp.risk as Severity) || undefined,
  });
  const canCreate = can(user, "hazard:create");

  return (
    <>
      <PageHeader
        title="Hazard Observations"
        description="Proactively report unsafe acts and conditions before they cause harm."
        actions={
          canCreate ? (
            <Link href="/hazards/new">
              <Button><Plus className="h-4 w-4" /> Submit Observation</Button>
            </Link>
          ) : undefined
        }
      />

      <form className="mb-4 flex flex-wrap items-end gap-2">
        <div className="min-w-52 flex-1">
          <Input name="q" placeholder="Search by ref or title…" defaultValue={sp.q ?? ""} />
        </div>
        <Select name="status" defaultValue={sp.status ?? ""} className="w-40">
          <option value="">All statuses</option>
          {HAZARD_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
        </Select>
        <Select name="risk" defaultValue={sp.risk ?? ""} className="w-40">
          <option value="">Any risk</option>
          {SEVERITIES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
        </Select>
        <Button type="submit" variant="outline">Filter</Button>
      </form>

      {rows.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <Eye className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No hazard observations found</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {canCreate ? "Every observation raised is a hazard removed." : "No observations match your filters."}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Ref</th>
                  <th className="px-4 py-2.5 font-medium">Title</th>
                  <th className="px-4 py-2.5 font-medium">Category</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">Risk</th>
                  <th className="px-4 py-2.5 font-medium">Observed</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-mono text-xs">
                      <Link href={`/hazards/${r.id}`} className="text-accent hover:underline">{r.refNo}</Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <Link href={`/hazards/${r.id}`} className="hover:underline">{r.title}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.category}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{humanize(r.hazardType)}</td>
                    <td className="px-4 py-2.5"><Badge tone={severityTone(r.riskLevel)}>{humanize(r.riskLevel)}</Badge></td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatDate(r.observedAt)}</td>
                    <td className="px-4 py-2.5"><Badge tone={statusTone(r.status)}>{humanize(r.status)}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
