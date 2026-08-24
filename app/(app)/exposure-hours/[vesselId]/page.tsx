import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarRange, Download, Archive } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { getVessel, getVesselExposureDetail, defaultYearRange } from "@/features/exposure-hours/queries";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { ExposureSummaryTiles } from "@/components/exposure/summary-tiles";
import { DateRangeFilter } from "@/components/exposure/date-range-filter";
import { CrewRosterPanel, InjuryCasesPanel, type CrewEntryView, type InjuryCaseView } from "./exposure-panel";

export default async function ExposureVesselRecordsPage({
  params,
  searchParams,
}: {
  params: Promise<{ vesselId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("exposure:read");
  const { vesselId } = await params;
  const sp = await searchParams;
  const isShipboard = user.department === "SHIPBOARD";
  const vessel = await getVessel(user.companyId, vesselId, isShipboard, user.vesselId);
  if (!vessel) notFound();

  const yearDefault = defaultYearRange();
  const from = sp.from ? new Date(sp.from) : yearDefault.from;
  const to = sp.to ? new Date(sp.to) : yearDefault.to;
  const detail = await getVesselExposureDetail(user.companyId, vesselId, { from, to });

  const ownVesselMatch = !isShipboard || user.vesselId === vesselId;
  const isArchived = vessel.archivedAt !== null;
  const canCreate = can(user, "exposure:create") && ownVesselMatch && !isArchived;
  const canManage = can(user, "exposure:update") && ownVesselMatch && !isArchived;
  const canDelete = can(user, "exposure:delete") && ownVesselMatch && !isArchived;

  const crewEntries: CrewEntryView[] = detail.crewEntries.map((e) => ({
    id: e.id,
    crew: e.crew,
    effectiveFrom: e.effectiveFrom.toISOString(),
    enteredBy: e.enteredBy,
  }));

  const cases: InjuryCaseView[] = detail.cases.map((c) => ({
    id: c.id,
    classification: c.classification,
    description: c.description,
    occurredOn: c.occurredOn.toISOString(),
  }));

  const reportQuery = new URLSearchParams({
    vesselId,
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  });

  return (
    <div className="mx-auto max-w-7xl">
      <Link href="/exposure-hours" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Exposure Hours
      </Link>

      <PageHeader
        title="Exposure Hours – Vessel Records"
        description={`Track exposure hours and related incident statistics for ${vessel.name}. Currently ${detail.currentCrew} crew onboard.`}
      />

      {isArchived && (
        <Card className="mb-4 flex items-center gap-2 border-warning/40 bg-warning/10 p-4 text-sm">
          <Archive className="h-4 w-4 shrink-0 text-warning" />
          <span>
            {vessel.name} left the fleet on <span className="font-medium">{formatDate(vessel.archivedAt!)}</span> —
            exposure hours stopped accruing as of that date and the crew roster / injury cases below are read-only.
          </span>
        </Card>
      )}

      <Card className="mb-4 p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <CalendarRange className="h-4 w-4 text-accent" /> Filter by Date Range
        </div>
        <DateRangeFilter
          defaultFrom={sp.from ?? from.toISOString().slice(0, 10)}
          defaultTo={sp.to ?? to.toISOString().slice(0, 10)}
        />
      </Card>

      <div className="mb-4">
        <ExposureSummaryTiles
          totals={detail.totals}
          actions={
            <Link href={`/exposure-hours/report?${reportQuery.toString()}`} target="_blank">
              <Button type="button" variant="outline" size="sm">
                <Download className="h-4 w-4" /> Export
              </Button>
            </Link>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CrewRosterPanel
          vesselId={vesselId}
          entries={crewEntries}
          canCreate={canCreate}
          canManage={canManage}
          canDelete={canDelete}
          suggestedStartDate={vessel.deliveryDate ? vessel.deliveryDate.toISOString().slice(0, 10) : undefined}
          suggestedCrew={vessel.totalComplement ?? undefined}
        />
        <InjuryCasesPanel vesselId={vesselId} cases={cases} editable={canManage} />
      </div>
    </div>
  );
}
