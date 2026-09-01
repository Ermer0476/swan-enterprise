import Link from "next/link";
import { Flame, LayoutGrid, ArrowLeft } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { listDrills, listVesselOptions } from "@/features/drills/queries";
import { listScheduleItems } from "@/features/schedule/queries";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pager } from "@/components/ui/pager";
import { readPage } from "@/lib/pagination";
import { formatDate, humanize } from "@/lib/utils";
import { lifecycleStatusTone } from "@/lib/status";
import type { DrillStatus } from "@/lib/generated/prisma";

export default async function DrillsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("drill:read");
  const sp = await searchParams;
  const isShipboard = user.department === "SHIPBOARD";
  const vesselId = isShipboard ? (user.vesselId ?? "__no-vessel-assigned__") : (sp.vesselId || undefined);

  const [{ rows, total, page, totalPages }, scheduleItems, vessels] = await Promise.all([
    listDrills(
      user.companyId,
      {
        search: sp.q || undefined,
        status: (sp.status as DrillStatus) || undefined,
        scheduleItemId: sp.scheduleItemId || undefined,
        vesselId,
      },
      isShipboard,
      user.id,
      readPage(sp),
    ),
    listScheduleItems(user.companyId, "DRILL"),
    isShipboard ? Promise.resolve([]) : listVesselOptions(user.companyId),
  ]);
  const canCreate = can(user, "drill:create");

  // Carries the selected vessel across to the Matrix view — an office user
  // who's just narrowed this list to one ship expects it to open already
  // scoped to that same ship, not the first vessel alphabetically.
  const matrixHref = vesselId ? `/drills/matrix?vesselId=${vesselId}` : "/drills/matrix";

  return (
    <>
      <Link
        href={matrixHref}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Drill Matrix
      </Link>

      <PageHeader
        title="Emergency Drills"
        description="Fire, abandon ship, man overboard and other SOLAS/ISM drill records."
        actions={
          <div className="flex items-center gap-2">
            <Link href={matrixHref}>
              <Button variant="outline"><LayoutGrid className="h-4 w-4" /> Drill Matrix</Button>
            </Link>
          </div>
        }
      />

      <form className="mb-4 flex flex-wrap items-end gap-2">
        <div className="min-w-52 flex-1">
          <Input name="q" placeholder="Search by ref or conducted by…" defaultValue={sp.q ?? ""} />
        </div>
        {!isShipboard && (
          <Select name="vesselId" defaultValue={sp.vesselId ?? ""} className="w-56">
            <option value="">All vessels</option>
            {vessels.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </Select>
        )}
        <Select name="scheduleItemId" defaultValue={sp.scheduleItemId ?? ""} className="w-64">
          <option value="">Any drill item</option>
          {scheduleItems.map((item) => (
            <option key={item.id} value={item.id}>
              {item.itemNo ? `${item.itemNo} — ` : ""}{item.name}
            </option>
          ))}
        </Select>
        <Select name="status" defaultValue={sp.status ?? ""} className="w-36">
          <option value="">All statuses</option>
          {canCreate && <option value="DRAFT">Draft</option>}
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
                  <th className="px-4 py-2.5 font-medium">Drill</th>
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
                      <Link href={`/drills/${r.id}`} className="text-accent hover:underline">{r.refNo ?? "Draft"}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {r.scheduleItem ? `${r.scheduleItem.itemNo ? `${r.scheduleItem.itemNo} — ` : ""}${r.scheduleItem.name}` : "—"}
                    </td>
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
          <Pager page={page} totalPages={totalPages} total={total} basePath="/drills" searchParams={sp} />
        </Card>
      )}
    </>
  );
}
