import Link from "next/link";
import { Plus, Flame } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { listDrills } from "@/features/drills/queries";
import { DRILL_TYPES } from "@/features/drills/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDate, humanize } from "@/lib/utils";
import { lifecycleStatusTone } from "@/lib/status";
import type { FindingStatus, DrillType } from "@/lib/generated/prisma";

export default async function DrillsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("drill:read");
  const sp = await searchParams;
  const rows = await listDrills(user.companyId, {
    search: sp.q || undefined,
    status: (sp.status as FindingStatus) || undefined,
    drillType: (sp.drillType as DrillType) || undefined,
  });
  const canCreate = can(user, "drill:create");

  return (
    <>
      <PageHeader
        title="Emergency Drills"
        description="Fire, abandon ship, man overboard and other SOLAS/ISM drill records."
        actions={
          canCreate ? (
            <Link href="/drills/new">
              <Button><Plus className="h-4 w-4" /> Record Drill</Button>
            </Link>
          ) : undefined
        }
      />

      <form className="mb-4 flex flex-wrap items-end gap-2">
        <div className="min-w-52 flex-1">
          <Input name="q" placeholder="Search by ref or conducted by…" defaultValue={sp.q ?? ""} />
        </div>
        <Select name="drillType" defaultValue={sp.drillType ?? ""} className="w-52">
          <option value="">Any type</option>
          {DRILL_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
        </Select>
        <Select name="status" defaultValue={sp.status ?? ""} className="w-36">
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="CLOSED">Closed</option>
        </Select>
        <Button type="submit" variant="outline">Filter</Button>
      </form>

      {rows.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <Flame className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No drills recorded</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {canCreate ? "Record an emergency drill to keep the fleet's SOLAS/ISM schedule on file." : "No drills match your filters."}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Ref</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">Vessel</th>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Conducted by</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-mono text-xs">
                      <Link href={`/drills/${r.id}`} className="text-accent hover:underline">{r.refNo}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{humanize(r.drillType)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.vessel?.name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatDate(r.drillDate)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.conductedBy ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <Badge tone={lifecycleStatusTone(r.status)}>{humanize(r.status)}</Badge>
                    </td>
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
