import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BarChart3, Plus } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { getVessel, listVessels } from "@/features/vessels/queries";
import { listVoyageLogsForVesselPaginated, getVoyageDiscrepancies } from "@/features/vessel-tracker/queries";
import { readPage } from "@/lib/pagination";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pager } from "@/components/ui/pager";
import { VoyageLogTable, type VoyageLogRowView } from "./voyage-log-table";
import { toRowView } from "./voyage-log-mappers";
import { VesselSwitcher } from "./vessel-switcher";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function VesselTrackerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ vesselId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("vtracker:read");
  const { vesselId } = await params;
  const sp = await searchParams;
  const [vessel, vessels] = await Promise.all([getVessel(user.companyId, vesselId), listVessels(user.companyId)]);
  if (!vessel) notFound();

  const today = new Date();
  const year = Number(sp.year) || today.getUTCFullYear();
  const month = Number(sp.month) || today.getUTCMonth() + 1; // 1-12

  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 0, 23, 59, 59));

  const { rows, total, page, totalPages } = await listVoyageLogsForVesselPaginated(user.companyId, vesselId, { from, to }, readPage(sp));

  // Voyage-wide, not scoped to this page's date range — a discrepancy's
  // anchor (the last Arrival, or the previous sailing report) can fall
  // outside whatever month happens to be on screen.
  const discrepancies = await getVoyageDiscrepancies(user.companyId, vesselId);

  const isShipboard = user.department === "SHIPBOARD";
  const ownVesselMatch = !isShipboard || user.vesselId === vesselId;
  const isArchived = vessel.archivedAt !== null;
  const canCreate = can(user, "vtracker:create") && ownVesselMatch && !isArchived;
  const canManage = can(user, "vtracker:update") && ownVesselMatch && !isArchived;

  const rowViews: VoyageLogRowView[] = rows.map((r) => toRowView(r, discrepancies.get(r.id) ?? null));

  const years = Array.from({ length: 4 }, (_, i) => today.getUTCFullYear() - i);

  return (
    <div className="mx-auto max-w-7xl">
      <Link href="/vessel-tracker" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Vessel Tracker
      </Link>

      <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title={`${vessel.name} — Voyage Log`}
          description="Daily voyage entries — same fields as the fleet's Voyage Input Data sheet, filled in here instead."
        />
        {!isShipboard && (
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Switch Vessel</label>
            <VesselSwitcher vessels={vessels} currentVesselId={vesselId} />
          </div>
        )}
      </div>

      <form className="mb-6 flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Year</label>
          <Select name="year" defaultValue={String(year)} className="w-28">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Month</label>
          <Select name="month" defaultValue={String(month)} className="w-40">
            {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </Select>
        </div>
        <Button type="submit" variant="outline">Apply</Button>
        <Link href={`/vessel-tracker/${vesselId}/kpi`}>
          <Button type="button" variant="warning">
            <BarChart3 className="h-4 w-4" /> KPI Dashboard
          </Button>
        </Link>
      </form>

      {canCreate && (
        <Link href={`/vessel-tracker/${vesselId}/new`} className="mb-6 inline-block">
          <Button type="button" variant="accent">
            <Plus className="h-4 w-4" /> Add Today&apos;s Entry
          </Button>
        </Link>
      )}

      <Card>
        <CardContent className="pt-5">
          <div className="mb-3 text-sm font-semibold">
            {MONTH_NAMES[month - 1]} {year} — {total} entr{total === 1 ? "y" : "ies"}
          </div>
          <VoyageLogTable vesselId={vesselId} rows={rowViews} editable={canManage} />
        </CardContent>
        <Pager page={page} totalPages={totalPages} total={total} basePath={`/vessel-tracker/${vesselId}`} searchParams={sp} />
      </Card>
    </div>
  );
}
