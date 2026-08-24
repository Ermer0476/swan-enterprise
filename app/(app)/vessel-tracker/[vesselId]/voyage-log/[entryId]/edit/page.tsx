import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { getVessel } from "@/features/vessels/queries";
import {
  getVoyageLogEntry,
  getBunkerRobHistory,
  getVoyageDiscrepancies,
  getPreviousSailingReport,
  getVoyageCumulativeTotals,
  getLastArrival,
  getPreviousEntry,
} from "@/features/vessel-tracker/queries";
import { PageHeader } from "@/components/ui/page-header";
import { toRowView, toEntryDefaults } from "../../../voyage-log-mappers";
import { EditEntryClient } from "./edit-entry-client";

export default async function EditVoyageLogEntryPage({ params }: { params: Promise<{ vesselId: string; entryId: string }> }) {
  const user = await requirePermission("vtracker:update");
  const { vesselId, entryId } = await params;
  const [vessel, entry] = await Promise.all([getVessel(user.companyId, vesselId), getVoyageLogEntry(user.companyId, entryId)]);
  if (!vessel || !entry || entry.vesselId !== vesselId) notFound();

  const isShipboard = user.department === "SHIPBOARD";
  const ownVesselMatch = !isShipboard || user.vesselId === vesselId;
  const isArchived = vessel.archivedAt !== null;
  if (!can(user, "vtracker:update") || !ownVesselMatch || isArchived) redirect(`/vessel-tracker/${vesselId}`);

  const before = { date: entry.date, createdAt: entry.createdAt };
  const [robHistory, discrepancies, previousSailingReport, cumulativeTotals, lastArrival, previousEntry] = await Promise.all([
    getBunkerRobHistory(user.companyId, vesselId),
    getVoyageDiscrepancies(user.companyId, vesselId),
    getPreviousSailingReport(user.companyId, vesselId, before),
    getVoyageCumulativeTotals(user.companyId, vesselId, entry.voyageNo, before),
    getLastArrival(user.companyId, vesselId, before),
    getPreviousEntry(user.companyId, vesselId, before),
  ]);

  const rowView = toRowView(entry, discrepancies.get(entry.id) ?? null);
  const defaults = toEntryDefaults(rowView);
  // Live-preview the same derived fields (Port Stay, Steaming Time, DTG,
  // the Voyage/Performance totals) while editing as the Add-entry form
  // does — scoped to strictly BEFORE this entry's own (date, createdAt)
  // position, so it never includes this row's own already-saved
  // contribution and can't double count against itself.
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

      <PageHeader title={`${vessel.name} — Edit Voyage Entry`} description={`${rowView.date} · ${rowView.voyageNo ?? "No voyage no."}`} />

      <EditEntryClient
        vesselId={vesselId}
        defaults={defaults}
        robHistory={robHistory}
        voyageCumulative={voyageCumulative}
        previousSailingReportDtg={previousSailingReport?.dtgNextPortNm ?? null}
      />
    </div>
  );
}
