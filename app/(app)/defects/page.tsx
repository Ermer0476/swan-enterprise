import Link from "next/link";
import { Plus, ListChecks } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { listDefects } from "@/features/defects/queries";
import { DEFECT_STATUSES, DEFECT_SEVERITIES } from "@/features/defects/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pager } from "@/components/ui/pager";
import { readPage } from "@/lib/pagination";
import { formatDate, humanize, severityTone } from "@/lib/utils";
import { defectStatusTone } from "@/features/defects/ui";
import type { DefectStatus, DefectSeverity } from "@/lib/generated/prisma";

export default async function DefectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("defect:read");
  const sp = await searchParams;
  const isShipboard = user.department === "SHIPBOARD";
  const vesselId = isShipboard ? (user.vesselId ?? "__no-vessel-assigned__") : (sp.vesselId || undefined);
  const { rows, total, page, totalPages } = await listDefects(
    user.companyId,
    {
      search: sp.q || undefined,
      status: (sp.status as DefectStatus) || undefined,
      severity: (sp.severity as DefectSeverity) || undefined,
      vesselId,
    },
    readPage(sp),
  );
  const canCreate = can(user, "defect:create");

  return (
    <>
      <PageHeader
        title="Defect List"
        description="Equipment and machinery defects tracked to rectification."
        actions={
          canCreate ? (
            <Link href="/defects/new">
              <Button><Plus className="h-4 w-4" /> Report Defect</Button>
            </Link>
          ) : undefined
        }
      />

      <form className="mb-4 flex flex-wrap items-end gap-2">
        <div className="min-w-52 flex-1">
          <Input name="q" placeholder="Search by ref or equipment…" defaultValue={sp.q ?? ""} />
        </div>
        <Select name="severity" defaultValue={sp.severity ?? ""} className="w-36">
          <option value="">Any severity</option>
          {DEFECT_SEVERITIES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
        </Select>
        <Select name="status" defaultValue={sp.status ?? ""} className="w-40">
          <option value="">All statuses</option>
          {DEFECT_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
        </Select>
        <Button type="submit" variant="outline">Filter</Button>
      </form>

      {rows.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <ListChecks className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No defects recorded</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {canCreate ? "Report an equipment defect to track it through to rectification." : "No defects match your filters."}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Ref</th>
                  <th className="px-4 py-2.5 font-medium">Equipment</th>
                  <th className="px-4 py-2.5 font-medium">Vessel</th>
                  <th className="px-4 py-2.5 font-medium">Severity</th>
                  <th className="px-4 py-2.5 font-medium">Raised</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-mono text-xs">
                      <Link href={`/defects/${r.id}`} className="text-accent hover:underline">{r.refNo}</Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <Link href={`/defects/${r.id}`} className="hover:underline">{r.equipment}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.vessel?.name ?? "—"}</td>
                    <td className="px-4 py-2.5"><Badge tone={severityTone(r.severity)}>{humanize(r.severity)}</Badge></td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatDate(r.dateRaised)}</td>
                    <td className="px-4 py-2.5"><Badge tone={defectStatusTone(r.status)}>{humanize(r.status)}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} totalPages={totalPages} total={total} basePath="/defects" searchParams={sp} />
        </Card>
      )}
    </>
  );
}
