import Link from "next/link";
import { Plus, FileWarning } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { listNcrs } from "@/features/non-conformities/queries";
import { NCR_STATUSES, NCR_SOURCES } from "@/features/non-conformities/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDate, humanize, severityTone } from "@/lib/utils";
import { ncrStatusTone } from "@/features/non-conformities/ui";
import type { NcrStatus, NcrSource } from "@/lib/generated/prisma";

export default async function NcrPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("ncr:read");
  const sp = await searchParams;
  const rows = await listNcrs(user.companyId, {
    search: sp.q || undefined,
    status: (sp.status as NcrStatus) || undefined,
    source: (sp.source as NcrSource) || undefined,
  });
  const canCreate = can(user, "ncr:create");

  return (
    <>
      <PageHeader
        title="Non-Conformities"
        description="Findings where a requirement is not met — tracked to verified close-out."
        actions={
          canCreate ? (
            <Link href="/non-conformities/new">
              <Button><Plus className="h-4 w-4" /> Raise NCR</Button>
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
          {NCR_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
        </Select>
        <Select name="source" defaultValue={sp.source ?? ""} className="w-44">
          <option value="">Any source</option>
          {NCR_SOURCES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
        </Select>
        <Button type="submit" variant="outline">Filter</Button>
      </form>

      {rows.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <FileWarning className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No non-conformities found</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {canCreate ? "Raise an NCR from an audit or inspection finding." : "No NCRs match your filters."}
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
                  <th className="px-4 py-2.5 font-medium">Source</th>
                  <th className="px-4 py-2.5 font-medium">Severity</th>
                  <th className="px-4 py-2.5 font-medium">Raised</th>
                  <th className="px-4 py-2.5 font-medium">Target</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-mono text-xs">
                      <Link href={`/non-conformities/${r.id}`} className="text-accent hover:underline">{r.refNo}</Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <Link href={`/non-conformities/${r.id}`} className="hover:underline">{r.title}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{humanize(r.source)}</td>
                    <td className="px-4 py-2.5"><Badge tone={severityTone(r.severity)}>{humanize(r.severity)}</Badge></td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatDate(r.raisedAt)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatDate(r.targetDate)}</td>
                    <td className="px-4 py-2.5"><Badge tone={ncrStatusTone(r.status)}>{humanize(r.status)}</Badge></td>
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
