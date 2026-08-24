"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Pencil, Trash2, FileText, AlertTriangle } from "lucide-react";
import { deleteVoyageLogAction } from "@/features/vessel-tracker/actions";
import { Card } from "@/components/ui/card";
import {
  VOYAGE_REPORT_TYPE_LABELS,
  VESSEL_TRACKER_STATUS_LABELS,
  LADEN_STATE_LABELS,
  ENGINE_ORDER_LABELS,
  foDoTotals,
  routeLabel,
  type VoyageReportTypeValue,
  type VesselTrackerStatusValue,
  type LadenStateValue,
  type EngineOrderValue,
  type BunkerGradeValue,
} from "@/features/vessel-tracker/schema";
import { VesselStatusBadge, LadenStateBadge, EngineOrderDot } from "@/components/vessel-tracker/status-icons";

// Some source workbooks store Obs Speed as a live distance/time formula
// rather than a typed-in value — reading it back gives full floating-point
// precision ("6.153846153846153") instead of the 1-2 decimals a deck
// officer would actually write down. Round for display only; the stored
// value is untouched.
function fmt(v: number | null, decimals = 2): string {
  return v == null ? "—" : v.toFixed(decimals);
}

// Mirrors EntryDiscrepancy in features/vessel-tracker/queries.ts — that
// file is server-only, so the shape is duplicated here rather than
// imported, same as VoyageCumulativeTotals is in voyage-entry-form.tsx.
export type EntryDiscrepancy = {
  kind: "port_stay" | "steaming_time";
  reportedHrs: number;
  computedHrs: number;
  diffHrs: number;
};

export type VoyageLogRowView = {
  id: string;
  discrepancy: EntryDiscrepancy | null;
  date: string; // yyyy-mm-dd
  voyageNo: string | null;
  reportType: VoyageReportTypeValue;
  vesselStatus: VesselTrackerStatusValue;
  ladenState: LadenStateValue;
  engineOrder: EngineOrderValue | null;
  steamingTimeHrs: number | null;
  obsSpeedKn: number | null;
  meSpeedKn: number | null;
  rpm: number | null;
  slipPct: number | null;
  beaufortScale: number | null;
  portStayHrs: number | null;
  totalPortStayHrs: number | null;
  offHireHrs: number | null;

  fromPort: string | null;
  nextPort: string | null;
  course: string | null;
  zoneDescription: string | null;
  reportTimeLocal: string | null;
  position: string | null;
  draftFwdM: number | null;
  draftAftM: number | null;
  draftMeanM: number | null;

  distanceRunNm: number | null;
  totalDistanceRunNm: number | null;
  dtgNextPortNm: number | null;
  totalSteamingTimeHrs: number | null;
  distanceLogNm: number | null;
  generalAvgSpeedKn: number | null;
  engineDistanceNm: number | null;
  totalEngineDistanceNm: number | null;
  generalAvgEngineSpeedKn: number | null;
  weatherCondition: string | null;
  generalAvgSlipPct: number | null;
  barometer: number | null;
  exhaustTempUnit: string | null;
  exhaustGasTemp: string | null;

  etaNextPortDate: string | null;
  etaNextPortTime: string | null;
  etaNextPortZd: string | null;

  cargoOnboard: string | null;
  cargoToDiscLoaded: string | null;
  blQuantity: number | null;
  cargoTemp: string | null;
  agentName: string | null;
  agentTel: string | null;
  agentFax: string | null;
  agentEmail: string | null;
  agentAddress: string | null;
  deckDeptReport: string | null;
  engineDeptReport: string | null;
  statementOfFacts: string | null;
  master: string | null;
  chiefEngineer: string | null;

  remarks: string | null;
  bunkers: { grade: BunkerGradeValue; previous: number | null; consumed: number | null; received: number | null; rob: number | null }[];
};

function Row({
  row,
  vesselId,
  editable,
}: {
  row: VoyageLogRowView;
  vesselId: string;
  editable: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showDiscrepancy, setShowDiscrepancy] = useState(false);
  const rowFoDo = foDoTotals(row.bunkers);

  // Click-to-arm confirm instead of window.confirm() — a native dialog can
  // be silently blocked (or auto-dismissed) inside an embedded/preview
  // browser frame, which made the delete button look completely
  // unresponsive rather than actually asking anything. Second click within
  // a few seconds is the confirmation; otherwise it auto-disarms.
  const [confirming, setConfirming] = useState(false);
  const disarmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (disarmTimer.current) clearTimeout(disarmTimer.current);
  }, []);

  function remove() {
    if (!confirming) {
      setConfirming(true);
      disarmTimer.current = setTimeout(() => setConfirming(false), 4000);
      return;
    }
    if (disarmTimer.current) clearTimeout(disarmTimer.current);
    setConfirming(false);
    setError(null);
    const fd = new FormData();
    fd.set("entryId", row.id);
    startTransition(async () => {
      const res = await deleteVoyageLogAction(fd);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <tr className="border-b border-border last:border-0">
      <td className="whitespace-nowrap px-3 py-2 tabular-nums">
        <span className="inline-flex items-center gap-1.5">
          {row.date}
          {row.discrepancy && (
            <button
              type="button"
              onClick={() => setShowDiscrepancy(true)}
              className="inline-flex rounded p-0.5 text-warning hover:bg-warning/10"
              aria-label="Hour discrepancy detected — click for details"
              title="Hour discrepancy detected — click for details"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
            </button>
          )}
        </span>
        {showDiscrepancy && row.discrepancy && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center whitespace-normal bg-black/50 p-4"
            onClick={() => setShowDiscrepancy(false)}
          >
            <Card className="w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning/10 text-warning">
                  <AlertTriangle className="h-4.5 w-4.5" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold">
                    {row.discrepancy.kind === "port_stay" ? "Port Stay hours don't add up" : "Steaming Time hours don't add up"}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {row.discrepancy.kind === "port_stay" ? (
                      <>
                        Crew-reported entries since the last Arrival sum to {row.discrepancy.reportedHrs.toFixed(1)} HRS, but the
                        computed elapsed time is {row.discrepancy.computedHrs.toFixed(1)} HRS.
                      </>
                    ) : (
                      <>
                        This entry reports {row.discrepancy.reportedHrs.toFixed(1)} HRS Steaming Time, but{" "}
                        {row.discrepancy.computedHrs.toFixed(1)} HRS actually elapsed since the previous report.
                      </>
                    )}
                  </p>
                  <p className="mt-2 text-sm">
                    Difference: <span className="font-semibold tabular-nums">{row.discrepancy.diffHrs.toFixed(1)} HRS</span>
                  </p>
                  <div className="mt-3 rounded-md border border-warning/30 bg-warning/5 p-3 text-xs">
                    <p className="font-medium text-foreground">What to check:</p>
                    {row.discrepancy.kind === "port_stay" ? (
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
                        <li>Open each &quot;While in Port&quot; entry since the last Arrival and confirm its Report Time.</li>
                        <li>Confirm each entry&apos;s Port Stay (hrs) actually matches the time between reports.</li>
                        <li>A day with no entry at all (a skipped report) will also show up as a gap here.</li>
                      </ul>
                    ) : (
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
                        <li>Check this entry&apos;s Report Time and the previous report&apos;s Report Time.</li>
                        <li>
                          If the vessel crossed a time zone, this is likely just the Zone Time (ZD) adjustment — no fix
                          needed, just confirm it.
                        </li>
                        <li>Otherwise, correct the Report Time or the Steaming Time (hrs), whichever was mistyped.</li>
                      </ul>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowDiscrepancy(false)}
                  className="rounded-md border border-input bg-transparent px-4 py-1.5 text-sm hover:bg-muted"
                >
                  Close
                </button>
              </div>
            </Card>
          </div>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2">{row.voyageNo ?? "—"}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{VOYAGE_REPORT_TYPE_LABELS[row.reportType]}</td>
      <td className="px-3 py-2">{routeLabel(row.fromPort, row.nextPort)}</td>
      <td className="px-3 py-2">
        <span className="inline-flex items-center gap-1.5">
          <VesselStatusBadge status={row.vesselStatus} /> {VESSEL_TRACKER_STATUS_LABELS[row.vesselStatus]}
        </span>
      </td>
      <td className="px-3 py-2">
        <span className="inline-flex items-center gap-1.5">
          <LadenStateBadge state={row.ladenState} /> {LADEN_STATE_LABELS[row.ladenState]}
        </span>
      </td>
      <td className="px-3 py-2">
        {row.engineOrder ? (
          <span className="inline-flex items-center gap-1.5">
            <EngineOrderDot order={row.engineOrder} /> {ENGINE_ORDER_LABELS[row.engineOrder]}
          </span>
        ) : (
          "—"
        )}
      </td>
      {/* Departure's Speed is an assumed/planned figure typed only to give
          the ETA calc something to work with — not a real reading — so it
          doesn't belong next to actual observed speeds in this column. */}
      <td className="px-3 py-2 text-right tabular-nums">{row.reportType === "DEPARTURE" ? "—" : fmt(row.obsSpeedKn)}</td>
      {/* DTG only means anything for the sea passage — Departure through
          Arrival — not while alongside. */}
      <td className="px-3 py-2 text-right tabular-nums">{row.reportType === "IN_PORT" ? "—" : fmt(row.dtgNextPortNm, 0)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{fmt(row.distanceRunNm, 0)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{fmt(row.steamingTimeHrs, 1)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{fmt(row.portStayHrs, 1)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{fmt(rowFoDo.foTotalMt)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{fmt(rowFoDo.doTotalMt)}</td>
      <td className="px-3 py-2">
        <Link
          href={`/vessel-tracker/${vesselId}/voyage-log/${row.id}/report`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="View Report"
        >
          <FileText className="h-3.5 w-3.5" />
        </Link>
      </td>
      {editable && (
        <td className="px-3 py-2">
          <div className="flex items-center justify-end gap-1">
            {confirming && <span className="text-xs text-danger">Confirm?</span>}
            <Link
              href={`/vessel-tracker/${vesselId}/voyage-log/${row.id}/edit`}
              className="inline-flex rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Link>
            <button
              type="button"
              disabled={pending}
              onClick={remove}
              className={`rounded p-1 ${confirming ? "bg-danger/10 text-danger" : "text-muted-foreground hover:bg-muted hover:text-danger"}`}
              aria-label={confirming ? "Click again to confirm delete" : "Delete"}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
        </td>
      )}
    </tr>
  );
}

export function VoyageLogTable({
  vesselId,
  rows,
  editable,
}: {
  vesselId: string;
  rows: VoyageLogRowView[];
  editable: boolean;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No voyage entries yet for this period.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Date</th>
            <th className="px-3 py-2 font-medium">Voyage No.</th>
            <th className="px-3 py-2 font-medium">Report</th>
            <th className="px-3 py-2 font-medium">From / Next Port</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">State</th>
            <th className="px-3 py-2 font-medium">Engine Order</th>
            <th className="px-3 py-2 font-medium text-right">Speed (kn)</th>
            <th className="px-3 py-2 font-medium text-right">DTG (nm)</th>
            <th className="px-3 py-2 font-medium text-right">Dist (nm)</th>
            <th className="px-3 py-2 font-medium text-right">Steaming Hrs</th>
            <th className="px-3 py-2 font-medium text-right">Port Stay (hrs)</th>
            <th className="px-3 py-2 font-medium text-right">F.O. Total (mt)</th>
            <th className="px-3 py-2 font-medium text-right">D.O. Total (mt)</th>
            <th className="px-3 py-2 font-medium"></th>
            {editable && <th className="px-3 py-2 font-medium"></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => <Row key={r.id} row={r} vesselId={vesselId} editable={editable} />)}
        </tbody>
      </table>
    </div>
  );
}
