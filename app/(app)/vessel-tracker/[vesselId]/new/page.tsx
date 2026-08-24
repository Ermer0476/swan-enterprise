import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { getVessel } from "@/features/vessels/queries";
import {
  getBunkerCarryForward,
  getBunkerRobHistory,
  getLastEntryCarryForward,
  getVoyageCumulativeTotalsToDate,
  getLastArrival,
  getPreviousEntry,
  getPreviousSailingReport,
} from "@/features/vessel-tracker/queries";
import { PageHeader } from "@/components/ui/page-header";
import { BLANK_VOYAGE_ENTRY } from "../voyage-entry-form";
import { NewEntryClient } from "./new-entry-client";

export default async function NewVoyageLogEntryPage({ params }: { params: Promise<{ vesselId: string }> }) {
  const user = await requirePermission("vtracker:create");
  const { vesselId } = await params;
  const vessel = await getVessel(user.companyId, vesselId);
  if (!vessel) notFound();

  const isShipboard = user.department === "SHIPBOARD";
  const ownVesselMatch = !isShipboard || user.vesselId === vesselId;
  const isArchived = vessel.archivedAt !== null;
  if (!can(user, "vtracker:create") || !ownVesselMatch || isArchived) redirect(`/vessel-tracker/${vesselId}`);

  const [bunkerCarryForward, robHistory, lastEntryCarryForward] = await Promise.all([
    getBunkerCarryForward(user.companyId, vesselId),
    getBunkerRobHistory(user.companyId, vesselId),
    getLastEntryCarryForward(user.companyId, vesselId),
  ]);

  const [cumulativeTotals, lastArrival, previousEntry, previousSailingReport] = await Promise.all([
    getVoyageCumulativeTotalsToDate(user.companyId, vesselId, lastEntryCarryForward?.voyageNo || null),
    getLastArrival(user.companyId, vesselId),
    getPreviousEntry(user.companyId, vesselId),
    getPreviousSailingReport(user.companyId, vesselId),
  ]);
  const voyageCumulative = {
    ...cumulativeTotals,
    lastArrival: lastArrival ? { date: lastArrival.date.toISOString().slice(0, 10), reportTimeLocal: lastArrival.reportTimeLocal } : null,
    previousEntry: previousEntry ? { date: previousEntry.date.toISOString().slice(0, 10), reportTimeLocal: previousEntry.reportTimeLocal } : null,
    previousSailingReport: previousSailingReport
      ? { date: previousSailingReport.date.toISOString().slice(0, 10), reportTimeLocal: previousSailingReport.reportTimeLocal }
      : null,
  };

  return (
    <div className="mx-auto max-w-7xl">
      <Link
        href={`/vessel-tracker/${vesselId}`}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to {vessel.name} — Voyage Log
      </Link>

      <PageHeader title={`${vessel.name} — New Voyage Entry`} description="Same fields as the fleet's Voyage Input Data sheet." />

      <NewEntryClient
        vesselId={vesselId}
        defaults={BLANK_VOYAGE_ENTRY}
        carryForward={lastEntryCarryForward ?? undefined}
        previousRob={bunkerCarryForward.previous}
        avgConsumed={bunkerCarryForward.avgConsumed}
        robHistory={robHistory}
        voyageCumulative={voyageCumulative}
        previousSailingReportDtg={previousSailingReport?.dtgNextPortNm ?? null}
      />
    </div>
  );
}
