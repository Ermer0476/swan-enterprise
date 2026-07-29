import Link from "next/link";
import { Plus, ShieldCheck } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { listInternalAudits } from "@/features/internal-audits/queries";
import { INSPECTION_STATUSES } from "@/features/internal-audits/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDate, humanize } from "@/lib/utils";
import type { InspectionStatus } from "@/lib/generated/prisma";

function statusTone(s: string) {
  return s === "CLOSED" ? "success" : s === "IN_PROGRESS" ? "warning" : "accent";
}

export default async function InternalAuditsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("iaudit:read");
  const sp = await searchParams;
  const rows = await listInternalAudits(user.companyId, {
    search: sp.q || undefined,
    status: (sp.status as InspectionStatus) || undefined,
  });
  const canCreate = can(user, "iaudit:create");

  return (
    <>
      <PageHeader
        title="Internal Audits"
        description="Company internal SMS audits and their finding close-out."
        actions={
          canCreate ? (
            <Link href="/internal-audits/new">
              <Button><Plus className="h-4 w-4" /> New Audit</Button>
            </Link>
          ) : undefined
        }
      />

      <form className="mb-4 flex flex-wrap items-end gap-2">
        <div className="min-w-52 flex-1">
          <Input name="q" placeholder="Search by ref or scope…" defaultValue={sp.q ?? ""} />
        </div>
        <Select name="status" defaultValue={sp.status ?? ""} className="w-44">
          <option value="">All statuses</option>
          {INSPECTION_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
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
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-mono text-xs">
                      <Link href={`/internal-audits/${r.id}`} className="text-accent hover:underline">{r.refNo}</Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <Link href={`/internal-audits/${r.id}`} className="hover:underline">{r.scope}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.standard}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.vessel?.name ?? "Shore"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatDate(r.auditDate)}</td>
                    <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{r._count.findings}</td>
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
