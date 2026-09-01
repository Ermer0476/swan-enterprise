import Link from "next/link";
import { Plus, BarChart3 } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { getFleetCalendarMonth, listFleetLastEntries } from "@/features/vessel-tracker/queries";
import {
  VESSEL_TRACKER_STATUS_LABELS,
  VOYAGE_REPORT_TYPE_LABELS,
  routeLabel,
} from "@/features/vessel-tracker/schema";
import { VesselStatusBadge, LadenStateBadge, EngineOrderDot, VesselStatusLegend } from "@/components/vessel-tracker/status-icons";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function VesselTrackerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("vtracker:read");
  const sp = await searchParams;

  const today = new Date();
  const year = Number(sp.year) || today.getUTCFullYear();
  const month = Number(sp.month) || today.getUTCMonth() + 1;
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 0, 23, 59, 59));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const dayNumbers = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // SHIPBOARD only ever sees their own vessel's row on this fleet dashboard
  // — never other vessels'. OFFICE stays unrestricted.
  const isShipboard = user.department === "SHIPBOARD";
  const vesselId = isShipboard ? (user.vesselId ?? "__no-vessel-assigned__") : undefined;
  // Shipboard's own vessel only — this fleet dashboard IS their vessel's
  // dashboard, so a quick-entry shortcut belongs right beside Apply instead
  // of making them click through to the per-vessel page first. Office sees
  // every vessel here, so there's no single target to add an entry for.
  const canCreate = isShipboard && !!user.vesselId && can(user, "vtracker:create");
  const [calendarRows, fleet] = await Promise.all([
    getFleetCalendarMonth(user.companyId, from, to, vesselId),
    listFleetLastEntries(user.companyId, vesselId),
  ]);

  const years = Array.from({ length: 4 }, (_, i) => today.getUTCFullYear() - i);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Vessel Tracker"
        description="Daily voyage/performance log per vessel — vessel status, laden/ballast state, engine order, speed and consumption at a glance."
      />

      <form className="mb-4 flex flex-wrap items-end gap-2">
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
        {canCreate && (
          <>
            <Link href={`/vessel-tracker/${user.vesselId}/new`}>
              <Button type="button" variant="accent">
                <Plus className="h-4 w-4" /> Add Today&apos;s Entry
              </Button>
            </Link>
            <Link href={`/vessel-tracker/${user.vesselId}/kpi`}>
              <Button type="button" variant="warning">
                <BarChart3 className="h-4 w-4" /> KPI Dashboard
              </Button>
            </Link>
          </>
        )}
      </form>

      <Card className="mb-6">
        <CardContent className="space-y-3 pt-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-semibold">Calendar View — {MONTH_NAMES[month - 1]} {year}</div>
            <VesselStatusLegend />
          </div>

          {calendarRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No voyage entries logged yet for {MONTH_NAMES[month - 1]} {year}.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="text-sm">
                <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="sticky left-0 z-10 bg-muted/40 px-3 py-2 font-medium">Vessel</th>
                    {dayNumbers.map((d) => (
                      <th key={d} className="min-w-[4.5rem] px-2 py-2 text-center font-medium">{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {calendarRows.map(({ vessel, days }) => (
                    <tr key={vessel.id} className="border-b border-border last:border-0">
                      <td className="sticky left-0 z-10 whitespace-nowrap bg-card px-3 py-2 font-medium">
                        <Link href={`/vessel-tracker/${vessel.id}`} className="text-accent hover:underline">
                          {vessel.name}
                        </Link>
                      </td>
                      {dayNumbers.map((d) => {
                        const entries = days.get(d);
                        const last = entries?.[entries.length - 1];
                        // Native title, not a CSS hover popup — the calendar
                        // sits inside an overflow-x-auto container, and per
                        // the CSS overflow spec a browser can't leave
                        // overflow-y as visible once overflow-x is set to
                        // anything but visible (it's silently forced to
                        // auto), which clipped an absolutely-positioned
                        // popup here. A native tooltip renders in its own
                        // OS-level layer, immune to that. One line per
                        // report logged that day (a port call day often has
                        // both an Arrival/Departure and a While-in-Port
                        // entry) — Port name + report type, so Departure/
                        // Arrival are always identifiable at a glance.
                        const tooltip = (entries ?? [])
                          .map((e) => `${routeLabel(e.fromPort, e.nextPort)} (${VOYAGE_REPORT_TYPE_LABELS[e.reportType]})`)
                          .join("\n");
                        return (
                          <td key={d} className="min-w-[4.5rem] px-2 py-2 text-center" title={tooltip || undefined}>
                            {last ? (
                              <span className="inline-flex flex-col items-center gap-1">
                                {/* Port + report type printed right on the
                                    cell — not hidden behind a hover, which
                                    the crew couldn't get to trigger
                                    reliably. Every report type logged that
                                    day, not just the last one — a port call
                                    day commonly has both a Departure (or
                                    Arrival) and a Noon Position entry, and
                                    both need to be visible, not just
                                    whichever was saved most recently. */}
                                <span className="max-w-[4.5rem] truncate text-[10px] font-semibold leading-tight text-foreground">
                                  {routeLabel(last.fromPort, last.nextPort)}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <VesselStatusBadge status={last.vesselStatus} />
                                  <LadenStateBadge state={last.ladenState} />
                                </span>
                                {last.engineOrder && <EngineOrderDot order={last.engineOrder} />}
                                {/* Each report type links straight to that
                                    entry's own report — clicking is how the
                                    crew actually opens it, not hovering. */}
                                {(entries ?? []).map((e) => (
                                  <Link
                                    key={e.id}
                                    href={`/vessel-tracker/${vessel.id}/voyage-log/${e.id}/report`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="max-w-[4.5rem] truncate text-[10px] font-medium leading-tight text-accent hover:underline"
                                  >
                                    {VOYAGE_REPORT_TYPE_LABELS[e.reportType]}
                                  </Link>
                                ))}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/30">·</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <div className="mb-3 text-sm font-semibold">Fleet — {fleet.length} vessels</div>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Vessel</th>
                  <th className="px-3 py-2 font-medium">Last Report</th>
                  <th className="px-3 py-2 font-medium">Last From / Next Port</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {fleet.map(({ vessel, lastEntry }) => (
                  <tr key={vessel.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">
                      <Link href={`/vessel-tracker/${vessel.id}`} className="font-medium text-accent hover:underline">
                        {vessel.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{lastEntry ? formatDate(lastEntry.date) : "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{lastEntry ? routeLabel(lastEntry.fromPort, lastEntry.nextPort) : "—"}</td>
                    <td className="px-3 py-2">
                      {lastEntry ? (
                        <span className="inline-flex items-center gap-1.5">
                          <VesselStatusBadge status={lastEntry.vesselStatus} /> {VESSEL_TRACKER_STATUS_LABELS[lastEntry.vesselStatus]}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">No entries yet</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link href={`/vessel-tracker/${vessel.id}`}>
                        <Button type="button" variant="outline" size="sm">
                          Go to Voyage Log
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
