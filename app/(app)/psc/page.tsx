import Link from "next/link";
import { Plus, Anchor } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { listPsc } from "@/features/psc/queries";
import { INSPECTION_STATUSES } from "@/features/psc/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDate, humanize } from "@/lib/utils";
import { lifecycleStatusTone } from "@/lib/status";
import type { InspectionStatus } from "@/lib/generated/prisma";

export default async function PscPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("psc:read");
  const sp = await searchParams;
  const rows = await listPsc(user.companyId, {
    search: sp.q || undefined,
    status: (sp.status as InspectionStatus) || undefined,
    detained: sp.detained === "1" ? true : undefined,
  });
  const canCreate = can(user, "psc:create");

  return (
    <>
      <PageHeader
        title="PSC Inspections"
        description="Port State Control inspections, deficiencies and detention tracking."
        actions={
          canCreate ? (
            <Link href="/psc/new">
              <Button><Plus className="h-4 w-4" /> Record Inspection</Button>
            </Link>
          ) : undefined
        }
      />

      <form className="mb-4 flex flex-wrap items-end gap-2">
        <div className="min-w-52 flex-1">
          <Input name="q" placeholder="Search by ref or authority…" defaultValue={sp.q ?? ""} />
        </div>
        <Select name="status" defaultValue={sp.status ?? ""} className="w-44">
          <option value="">All statuses</option>
          {INSPECTION_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
        </Select>
        <Select name="detained" defaultValue={sp.detained ?? ""} className="w-40">
          <option value="">Any outcome</option>
          <option value="1">Detained only</option>
        </Select>
        <Button type="submit" variant="outline">Filter</Button>
      </form>

      {rows.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <Anchor className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No PSC inspections recorded</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {canCreate ? "Record a PSC inspection and log any deficiencies." : "No inspections match your filters."}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Ref</th>
                  <th className="px-4 py-2.5 font-medium">Authority</th>
                  <th className="px-4 py-2.5 font-medium">Vessel</th>
                  <th className="px-4 py-2.5 font-medium">Port</th>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Def.</th>
                  <th className="px-4 py-2.5 font-medium">Outcome</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-mono text-xs">
                      <Link href={`/psc/${r.id}`} className="text-accent hover:underline">{r.refNo}</Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <Link href={`/psc/${r.id}`} className="hover:underline">{r.authority}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.vessel?.name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.port ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatDate(r.inspectionDate)}</td>
                    <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{r._count.deficiencies}</td>
                    <td className="px-4 py-2.5">
                      {r.detained ? <Badge tone="danger">Detained</Badge> : <Badge tone="success">Not detained</Badge>}
                    </td>
                    <td className="px-4 py-2.5"><Badge tone={lifecycleStatusTone(r.status)}>{humanize(r.status)}</Badge></td>
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
