import Link from "next/link";
import { Plus, ShieldCheck, CalendarClock } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { listInternalAudits, listInternalAuditSchedule, internalAuditScheduleAlerts } from "@/features/internal-audits/queries";
import { INSPECTION_STATUSES } from "@/features/internal-audits/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pager } from "@/components/ui/pager";
import { readPage } from "@/lib/pagination";
import { formatDate, humanize } from "@/lib/utils";
import { lifecycleStatusTone } from "@/lib/status";
import type { InternalAuditStatus } from "@/lib/generated/prisma";

export default async function InternalAuditsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("iaudit:read");
  const sp = await searchParams;
  const isShipboard = user.department === "SHIPBOARD";
  const vesselId = isShipboard ? user.vesselId ?? "__no-vessel-assigned__" : sp.vesselId || undefined;
  const { rows, total, page, totalPages } = await listInternalAudits(
    user.companyId,
    {
      search: sp.q || undefined,
      status: (sp.status as InternalAuditStatus) || undefined,
      vesselId,
    },
    user.id,
    readPage(sp),
  );
  const canCreate = can(user, "iaudit:create");
  const scheduleAlertCount = canCreate
    ? internalAuditScheduleAlerts(await listInternalAuditSchedule(user.companyId)).length
    : 0;

  return (
    <>
      <PageHeader
        title="Internal Audits"
        description="Company internal SMS audits and their finding close-out."
        actions={
          canCreate ? (
            <div className="flex items-center gap-2">
              <Link href="/internal-audits/schedule" className="relative">
                <Button variant="outline"><CalendarClock className="h-4 w-4" /> Internal Audit Schedule</Button>
                {scheduleAlertCount > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-warning px-1.5 text-[11px] font-semibold text-white">
                    {scheduleAlertCount}
                  </span>
                )}
              </Link>
              <Link href="/internal-audits/new">
                <Button><Plus className="h-4 w-4" /> New Audit</Button>
              </Link>
            </div>
          ) : undefined
        }
      />

      <form className="mb-4 flex flex-wrap items-end gap-2">
        <div className="min-w-52 flex-1">
          <Input name="q" placeholder="Search by ref or scope…" defaultValue={sp.q ?? ""} />
        </div>
        <Select name="status" defaultValue={sp.status ?? ""} className="w-44">
          <option value="">All statuses</option>
          {INSPECTION_STATUSES.filter((s) => s !== "DRAFT" || canCreate).map((s) => (
            <option key={s} value={s}>{humanize(s)}</option>
          ))}
        </Select>
        <Button type="submit" variant="outline">Filter</Button>
      </form>

      {rows.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <ShieldCheck className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No internal audits recorded</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {canCreate ? "Plan an internal audit and record its findings." : "No audits match your filters."}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Ref</th>
                  <th className="px-4 py-2.5 font-medium">Scope</th>
                  <th className="px-4 py-2.5 font-medium">Standard</th>
                  <th className="px-4 py-2.5 font-medium">Vessel</th>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Findings</th>
                  <th className="px-4 py-2.5 font-medium">CAPA Tracker</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-mono text-xs">
                      <Link href={`/internal-audits/${r.id}`} className="text-accent hover:underline">{r.refNo ?? "Draft"}</Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <Link href={`/internal-audits/${r.id}`} className="hover:underline">{r.scope}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.standard}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.vessel?.name ?? "Shore"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatDate(r.auditDate)}</td>
                    <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{r.findingCount}</td>
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
                    <td className="px-4 py-2.5"><Badge tone={lifecycleStatusTone(r.status)}>{humanize(r.status)}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} totalPages={totalPages} total={total} basePath="/internal-audits" searchParams={sp} />
        </Card>
      )}
    </>
  );
}
