import Link from "next/link";
import { Plus, ShieldAlert } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { listNearMisses } from "@/features/near-miss/queries";
import { NM_STATUSES, SEVERITIES } from "@/features/near-miss/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  const rows = await listNearMisses(user.companyId, {
    search: sp.q || undefined,
    status: (sp.status as NearMissStatus) || undefined,
    potentialSeverity: (sp.sev as Severity) || undefined,
  });
  const canCreate = can(user, "nm:create");

  return (
    <>
      <PageHeader
        title="Near Miss Reporting"
        description="Report events that could have caused harm — captured by potential severity."
        actions={
          canCreate ? (
            <Link href="/near-miss/new">
              <Button>
                <Plus className="h-4 w-4" /> Report Near Miss
              </Button>
            </Link>
          ) : undefined
        }
      />

      <form className="mb-4 flex flex-wrap items-end gap-2">
        <div className="min-w-52 flex-1">
          <Input name="q" placeholder="Search by ref or title…" defaultValue={sp.q ?? ""} />
        </div>
        <Select name="status" defaultValue={sp.status ?? ""} className="w-44">
          <option value="">All statuses</option>
          {NM_STATUSES.map((s) => (
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
                potentialSeverity: r.potentialSeverity,
                occurredAt: r.occurredAt.toISOString(),
                status: r.status,
              }))}
            />
          </div>
        </Card>
      )}
    </>
  );
}
