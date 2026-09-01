import Link from "next/link";
import { Plus, ClipboardCheck, BarChart3 } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { listCompanyInspections, listVesselOptions } from "@/features/company-inspections/queries";
import {
  INSPECTION_STATUSES,
  COMPANY_INSPECTION_TYPES,
  COMPANY_INSPECTION_TYPE_LABELS,
  COMPANY_INSPECTION_VISIT_KIND_LABELS,
} from "@/features/company-inspections/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pager } from "@/components/ui/pager";
import { formatDate, humanize } from "@/lib/utils";
import { lifecycleStatusTone } from "@/lib/status";
import { readPage } from "@/lib/pagination";
import type { InspectionStatus, CompanyInspectionType } from "@/lib/generated/prisma";

export default async function CompanyInspectionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("cinsp:read");
  const sp = await searchParams;
  const isShipboard = user.department === "SHIPBOARD";
  const vesselId = isShipboard ? (user.vesselId ?? "__no-vessel-assigned__") : (sp.vesselId || undefined);
  const [{ rows, total, page, totalPages }, vessels] = await Promise.all([
    listCompanyInspections(
      user.companyId,
      {
        search: sp.q || undefined,
        status: (sp.status as InspectionStatus) || undefined,
        inspectionType: (sp.type as CompanyInspectionType) || undefined,
        vesselId,
      },
      readPage(sp),
    ),
    listVesselOptions(user.companyId),
  ]);
  const canCreate = can(user, "cinsp:create");

  return (
    <>
      <PageHeader
        title="Company Inspections"
        description="Company-conducted vessel inspections and their observation close-out."
        actions={
          canCreate ? (
            <div className="flex items-center gap-2">
              <Link href="/company-inspections/kpi">
                <Button variant="warning"><BarChart3 className="h-4 w-4" /> Inspection KPIs</Button>
              </Link>
              <Link href="/company-inspections/new">
                <Button><Plus className="h-4 w-4" /> New Inspection</Button>
              </Link>
            </div>
          ) : undefined
        }
      />

      <form className="mb-4 flex flex-wrap items-end gap-2">
        <div className="min-w-52 flex-1">
          <Input name="q" placeholder="Search by ref, inspector or port…" defaultValue={sp.q ?? ""} />
        </div>
        <Select name="vesselId" defaultValue={sp.vesselId ?? ""} className="w-56">
          <option value="">All vessels</option>
          {vessels.map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </Select>
        <Select name="status" defaultValue={sp.status ?? ""} className="w-44">
          <option value="">All statuses</option>
          {INSPECTION_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
        </Select>
        <Select name="type" defaultValue={sp.type ?? ""} className="w-44">
          <option value="">All types</option>
          {COMPANY_INSPECTION_TYPES.map((t) => (
            <option key={t} value={t}>{COMPANY_INSPECTION_TYPE_LABELS[t]}</option>
          ))}
        </Select>
        <Button type="submit" variant="outline">Filter</Button>
      </form>

      {rows.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <ClipboardCheck className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No company inspections recorded</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {canCreate ? "Record a company inspection and log its observations." : "No inspections match your filters."}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Ref. No.</th>
                  <th className="px-4 py-2.5 font-medium">Vessel/Company</th>
                  <th className="px-4 py-2.5 font-medium">Date of Inspection</th>
                  <th className="px-4 py-2.5 font-medium">CAPA Tracker</th>
                  <th className="px-4 py-2.5 font-medium">Type of Inspection</th>
                  <th className="px-4 py-2.5 font-medium">Kind of Inspection</th>
                  <th className="px-4 py-2.5 font-medium">Obs</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-mono text-xs">
                      <Link href={`/company-inspections/${r.id}`} className="text-accent hover:underline">{r.refNo}</Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <Link href={`/company-inspections/${r.id}`} className="hover:underline">{r.vessel?.name ?? "Shore"}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatDate(r.inspectionDate)}</td>
                    <td className="px-4 py-2.5">
                      {r.capaPending === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          <span>{r.capaPending} Pending</span>
                          {r.capaOverdue > 0 && (
                            <span className="text-xs font-medium text-danger">{r.capaOverdue} Overdue</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {r.inspectionType ? (
                        <Badge tone={r.inspectionType === "SAFETY" ? "warning" : "neutral"}>
                          {COMPANY_INSPECTION_TYPE_LABELS[r.inspectionType]}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {r.visitKind ? COMPANY_INSPECTION_VISIT_KIND_LABELS[r.visitKind] : "—"}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                      {r.obsTotal > 0 ? `${r.obsClosed}/${r.obsTotal}` : "—"}
                    </td>
                    <td className="px-4 py-2.5"><Badge tone={lifecycleStatusTone(r.status)}>{humanize(r.status)}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} totalPages={totalPages} total={total} basePath="/company-inspections" searchParams={sp} />
        </Card>
      )}
    </>
  );
}
