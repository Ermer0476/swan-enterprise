import Link from "next/link";
import { Plus, ShieldAlert, BarChart3 } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { listNearMisses } from "@/features/near-miss/queries";
import { NM_STATUSES, SEVERITIES, nearMissStatusLabel, nearMissStatusTone } from "@/features/near-miss/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pager } from "@/components/ui/pager";
import { readPage } from "@/lib/pagination";
import { humanize } from "@/lib/utils";
import { NearMissTable } from "./near-miss-table";
import type { NearMissStatus, Severity } from "@/lib/generated/prisma";

export default async function NearMissPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("nm:read");
  const sp = await searchParams;
  const { rows, total, page, totalPages } = await listNearMisses(
    user.companyId,
    {
      search: sp.q || undefined,
      status: (sp.status as NearMissStatus) || undefined,
      potentialSeverity: (sp.sev as Severity) || undefined,
    },
    user.department === "SHIPBOARD",
    user.id,
    user.vesselId,
    readPage(sp),
  );
  const canCreate = can(user, "nm:create");

  return (
    <>
      <PageHeader
        title="Near Miss/HOR Reporting"
        description="Report near misses and hazard observations — captured by potential severity."
        actions={
          canCreate ? (
            <div className="flex items-center gap-2">
              <Link href="/near-miss/kpi">
                <Button variant="warning">
                  <BarChart3 className="h-4 w-4" /> Near Miss/HOR KPIs
                </Button>
              </Link>
              <Link href="/near-miss/new">
                <Button>
                  <Plus className="h-4 w-4" /> Report Near Miss/HOR
                </Button>
              </Link>
            </div>
          ) : undefined
        }
      />

      <form className="mb-4 flex flex-wrap items-end gap-2">
        <div className="min-w-52 flex-1">
          <Input name="q" placeholder="Search by ref or title…" defaultValue={sp.q ?? ""} />
        </div>
        <Select name="status" defaultValue={sp.status ?? ""} className="w-44">
          <option value="">All statuses</option>
          {NM_STATUSES.filter((s) => s !== "DRAFT" || canCreate).map((s) => (
            <option key={s} value={s}>{humanize(s)}</option>
          ))}
        </Select>
        <Select name="sev" defaultValue={sp.sev ?? ""} className="w-44">
          <option value="">Any potential severity</option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>{humanize(s)}</option>
          ))}
        </Select>
        <Button type="submit" variant="outline">Filter</Button>
      </form>

      {rows.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <ShieldAlert className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No near misses found</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {canCreate
              ? "Reporting near misses proactively prevents incidents."
              : "No near misses match your filters."}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <NearMissTable
              rows={rows.map((r) => ({
                id: r.id,
                refNo: r.refNo,
                title: r.title,
                vesselName: r.vessel?.name ?? null,
                kind: r.kind,
                potentialSeverity: r.potentialSeverity,
                occurredAt: r.occurredAt.toISOString(),
                status: r.status,
                statusLabel: nearMissStatusLabel(r.status, user.department),
                statusTone: nearMissStatusTone(r.status),
              }))}
            />
          </div>
          <Pager page={page} totalPages={totalPages} total={total} basePath="/near-miss" searchParams={sp} />
        </Card>
      )}
    </>
  );
}
