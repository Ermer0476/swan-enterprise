import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { requirePermission } from "@/lib/rbac";
import { getVoyageLogEntry, getLastArrival, sumPortStayHrsSinceArrival } from "@/features/vessel-tracker/queries";
import {
  VOYAGE_REPORT_TYPE_LABELS,
  VESSEL_TRACKER_STATUS_LABELS,
  LADEN_STATE_LABELS,
  ENGINE_ORDER_LABELS,
  BUNKER_GRADE_LABELS,
  reportDateTimeMs,
  type BunkerGradeValue,
} from "@/features/vessel-tracker/schema";
import { PrintButton } from "@/components/ui/print-button";

// Matches the fleet's real daily "Vessel Tracker" report (btsolve.com) —
// same boxed-table look, same section order — rather than the app's usual
// Card-based report style, so what's printed here is recognizable as the
// same document the office and ships already use.
const REPORT_TITLES: Record<string, string> = {
  IN_PORT: "WHILE IN PORT (MORNING)",
  ARRIVAL: "ARRIVAL REPORT",
  DEPARTURE: "DEPARTURE REPORT",
  NOON_AT_SEA: "NOON POSITION REPORT",
};

// Category groupings for the bunker ledger table — mirrors how the real
// report merges HSFO/LSFO under one "Fuel Oil" cell, HSDO/LSDO under
// "Diesel Oil", etc. Grades with no shared category show their own label.
const BUNKER_GROUPS: { category: string | null; grades: BunkerGradeValue[] }[] = [
  { category: "Fuel Oil", grades: ["HSFO", "LSFO"] },
  { category: "Diesel Oil", grades: ["HSDO", "LSDO"] },
  { category: "Marine Gas Oil", grades: ["HSGO", "LSGO"] },
  { category: null, grades: ["CYL_OIL"] },
  { category: null, grades: ["MELO"] },
  { category: null, grades: ["GELO"] },
  { category: null, grades: ["FRESH_WATER"] },
  { category: null, grades: ["FRESH_WATER_PRODUCTION"] },
];

function gradeLabel(grade: BunkerGradeValue): string {
  const full = BUNKER_GRADE_LABELS[grade];
  const dash = full.indexOf(" — ");
  return dash === -1 ? full : full.slice(dash + 3);
}

function fmtDate(value: Date | string | null | undefined): string {
  if (!value) return "N/A";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("en-US", { month: "long", day: "2-digit", year: "numeric" });
}

function fmtNum(value: number | null | undefined, decimals = 2): string {
  return value == null ? "0" : value.toFixed(decimals);
}

// A label cell + value cell pair, styled like the real report's grey-label /
// white-value boxed rows. `span` lets a value cell stretch across the
// remaining columns when there's no paired field to its right.
function Row({ pairs }: { pairs: { label: string; value: string; span?: number }[] }) {
  return (
    <tr>
      {pairs.map((p, i) => (
        <Fragment key={i}>
          <td className="border border-border bg-muted/40 px-3 py-1.5 text-sm font-semibold whitespace-nowrap">
            {p.label}:
          </td>
          <td className="border border-border px-3 py-1.5 text-sm" colSpan={p.span}>
            {p.value || "N/A"}
          </td>
        </Fragment>
      ))}
    </tr>
  );
}

function SectionBar({ title }: { title: string }) {
  return (
    <tr>
      <td colSpan={4} className="border border-border bg-muted/60 px-3 py-1.5 text-sm font-bold uppercase tracking-wide">
        {title}
      </td>
    </tr>
  );
}

// The six figures that genuinely pair a raw "today" reading against its
// running voyage total — laid out side by side (Last 24 Hours vs Voyage To
// Date) so the vessel and whoever reads the report afterward can compare
// them at a glance, instead of hunting for the matching total several rows
// down in a single interleaved list.
function NavPerformanceBox({ pairs }: { pairs: { label: string; value: string; totalLabel: string; totalValue: string }[] }) {
  return (
    <table className="mt-[-1px] w-full border-collapse">
      <thead>
        <tr>
          <td colSpan={2} className="border border-border bg-muted/60 px-3 py-1.5 text-center text-sm font-bold uppercase tracking-wide">
            Navigation &amp; Performance
          </td>
        </tr>
        <tr>
          <td className="border border-border bg-muted/30 px-3 py-2 text-center">
            <div className="text-xs font-bold uppercase tracking-wide">Last 24 Hours</div>
            <div className="text-[11px] font-normal normal-case text-muted-foreground">Current Reporting Period</div>
          </td>
          <td className="border border-border bg-muted/30 px-3 py-2 text-center">
            <div className="text-xs font-bold uppercase tracking-wide">Voyage To Date</div>
            <div className="text-[11px] font-normal normal-case text-muted-foreground">Since Voyage Commencement</div>
          </td>
        </tr>
      </thead>
      <tbody>
        {pairs.map((p) => (
          <tr key={p.label}>
            <td className="border border-border px-3 py-2">
              <div className="text-xs text-muted-foreground">{p.label}</div>
              <div className="text-sm font-semibold tabular-nums">{p.value}</div>
            </td>
            <td className="border border-border px-3 py-2">
              <div className="text-xs text-muted-foreground">{p.totalLabel}</div>
              <div className="text-sm font-semibold tabular-nums">{p.totalValue}</div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function VoyageLogReportPage({
  params,
}: {
  params: Promise<{ vesselId: string; entryId: string }>;
}) {
  const user = await requirePermission("vtracker:read");
  const { vesselId, entryId } = await params;
  const entry = await getVoyageLogEntry(user.companyId, entryId);
  if (!entry || entry.vesselId !== vesselId) notFound();

  const isPortOnly = entry.reportType === "IN_PORT";
  const isNoon = entry.reportType === "NOON_AT_SEA";
  const isDeparture = entry.reportType === "DEPARTURE";
  const bunkerByGrade = new Map(entry.bunkers.map((b) => [b.grade, b]));

  // Total Time in Port — computed live (Arrival timestamp to this entry's
  // own timestamp) rather than trusted from entry.totalPortStayHrs, which
  // only reflects entries saved after this calc shipped. Also cross-checked
  // against what the crew's own daily Port Stay hrs entries add up to,
  // since those are typed independently of Report Time — a meaningful
  // mismatch usually means a wrong Report Time or a mistyped Port Stay
  // figure somewhere in the stay, worth flagging on the report itself
  // rather than leaving it to only show up as a quietly-wrong total.
  const PORT_STAY_TOLERANCE_HRS = 1;
  let totalPortStayHrs: number | null = null;
  let portStayDiscrepancy: { reported: number; diff: number } | null = null;
  if (isPortOnly || isDeparture) {
    const lastArrival = await getLastArrival(user.companyId, vesselId, { date: entry.date, createdAt: entry.createdAt });
    if (lastArrival) {
      totalPortStayHrs =
        (reportDateTimeMs(entry.date, entry.reportTimeLocal) - reportDateTimeMs(lastArrival.date, lastArrival.reportTimeLocal)) / 3_600_000;
      const reported = await sumPortStayHrsSinceArrival(user.companyId, vesselId, lastArrival, { date: entry.date, createdAt: entry.createdAt });
      const diff = Math.abs(totalPortStayHrs - reported);
      if (diff > PORT_STAY_TOLERANCE_HRS) portStayDiscrepancy = { reported, diff };
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-6 print:max-w-none print:p-3">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link
          href={`/vessel-tracker/${vesselId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to voyage log
        </Link>
        <PrintButton />
      </div>

      <h1 className="mb-4 text-center text-lg font-bold uppercase tracking-wide">
        {REPORT_TITLES[entry.reportType] ?? VOYAGE_REPORT_TYPE_LABELS[entry.reportType]}
      </h1>

      <table className="w-full border-collapse">
        <tbody>
          <Row
            pairs={[
              { label: "Vessel", value: entry.vessel.name },
              { label: "Voyage No.", value: entry.voyageNo ?? "N/A" },
            ]}
          />
          <Row
            pairs={[
              { label: "From Port", value: entry.fromPort ?? "N/A" },
              { label: "Next Port", value: entry.nextPort ?? "N/A" },
            ]}
          />
          <Row pairs={[{ label: "Course", value: entry.course ?? "N/A", span: 3 }]} />
          <Row
            pairs={[
              { label: "Date", value: fmtDate(entry.date) },
              {
                label: "Time",
                value: [entry.reportTimeLocal, entry.zoneDescription ? `ZD: ${entry.zoneDescription}` : null]
                  .filter(Boolean)
                  .join("   ") || "N/A",
              },
            ]}
          />
          <Row
            pairs={[
              { label: "Vessel Status", value: VESSEL_TRACKER_STATUS_LABELS[entry.vesselStatus] },
              { label: "Laden / Ballast", value: LADEN_STATE_LABELS[entry.ladenState] },
            ]}
          />
          {entry.engineOrder && (
            <Row pairs={[{ label: "Engine Order", value: ENGINE_ORDER_LABELS[entry.engineOrder], span: 3 }]} />
          )}

          <SectionBar title="Position" />
          <Row pairs={[{ label: "Position", value: entry.position ?? "N/A", span: 3 }]} />

          <SectionBar title="Draft" />
          <Row
            pairs={[
              { label: "FWD (m)", value: fmtNum(entry.draftFwdM) },
              { label: "AFT (m)", value: fmtNum(entry.draftAftM) },
            ]}
          />
          <Row pairs={[{ label: "MEAN (m)", value: fmtNum(entry.draftMeanM), span: 3 }]} />
        </tbody>
      </table>

      {isPortOnly && (
        <>
          <NavPerformanceBox
            pairs={[
              {
                label: "Port Stay",
                value: `${fmtNum(entry.portStayHrs, 1)} HRS`,
                totalLabel: "Total Time in Port",
                totalValue: `${fmtNum(totalPortStayHrs, 1)} HRS`,
              },
            ]}
          />
          {portStayDiscrepancy && (
            <div className="mt-2 flex items-start gap-2.5 rounded-md border border-warning bg-warning/10 px-4 py-3 text-sm text-warning print:border print:bg-transparent">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p>
                  <span className="font-medium">Port Stay hours don&apos;t add up.</span> Crew-reported entries since
                  Arrival sum to {fmtNum(portStayDiscrepancy.reported, 1)} HRS, but the computed elapsed time is{" "}
                  {fmtNum(totalPortStayHrs, 1)} HRS — a difference of {fmtNum(portStayDiscrepancy.diff, 1)} HRS.
                </p>
                <p className="mt-1.5">
                  <span className="font-medium">What to check:</span> open each &quot;While in Port&quot; entry since
                  the last Arrival and confirm its Report Time, and that its Port Stay (hrs) matches the time between
                  reports. A skipped day (no report at all) will also show up as a gap here.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {!isPortOnly && (
        <>
          <NavPerformanceBox
            pairs={[
              {
                label: "Distance Run",
                value: `${fmtNum(entry.distanceRunNm, 1)} NM`,
                totalLabel: "Total Distance Run",
                totalValue: `${fmtNum(entry.totalDistanceRunNm, 1)} NM`,
              },
              {
                label: "Steaming Time",
                value: `${fmtNum(entry.steamingTimeHrs, 1)} HRS`,
                totalLabel: "Total Steaming Time",
                totalValue: `${fmtNum(entry.totalSteamingTimeHrs, 1)} HRS`,
              },
              {
                label: "Observed Speed",
                value: `${fmtNum(entry.obsSpeedKn)} KN`,
                totalLabel: "General Average Speed",
                totalValue: `${fmtNum(entry.generalAvgSpeedKn)} KN`,
              },
              {
                label: "Engine Distance",
                value: `${fmtNum(entry.engineDistanceNm, 1)} NM`,
                totalLabel: "Total Engine Distance",
                totalValue: `${fmtNum(entry.totalEngineDistanceNm, 1)} NM`,
              },
              {
                label: "RPM",
                value: fmtNum(entry.rpm, 1),
                totalLabel: "General Avg Engine Speed",
                totalValue: `${fmtNum(entry.generalAvgEngineSpeedKn)} KN`,
              },
              {
                label: "Slip",
                value: `${fmtNum(entry.slipPct)} %`,
                totalLabel: "General Avg Slip",
                totalValue: `${fmtNum(entry.generalAvgSlipPct)} %`,
              },
            ]}
          />

          <table className="mt-[-1px] w-full border-collapse">
            <tbody>
              {/* Departure closes out the port call that just ended — this
                  is the one place the crew and office actually want the
                  final tally, rather than repeating it on every sea-passage
                  report for the rest of the voyage. */}
              {isDeparture && totalPortStayHrs != null && totalPortStayHrs > 0 && (
                <Row
                  pairs={[
                    { label: "Total Time in Port (Last Stay)", value: `${fmtNum(totalPortStayHrs, 1)} HRS`, span: 3 },
                  ]}
                />
              )}
              <Row
                pairs={[
                  { label: "DTG Next Port (nm)", value: fmtNum(entry.dtgNextPortNm, 1) },
                  { label: "Distance Log (nm)", value: fmtNum(entry.distanceLogNm, 1) },
                ]}
              />
              <Row
                pairs={[
                  { label: "M/E Speed (kn)", value: fmtNum(entry.meSpeedKn) },
                  { label: "Beaufort Scale", value: entry.beaufortScale != null ? String(entry.beaufortScale) : "N/A" },
                ]}
              />
              <Row
                pairs={[
                  { label: "Weather Condition", value: entry.weatherCondition ?? "N/A" },
                  { label: "Barometer", value: fmtNum(entry.barometer, 1) },
                ]}
              />

              {isNoon && (
                <Row
                  pairs={[
                    { label: "Exhaust Temp Unit", value: entry.exhaustTempUnit ?? "N/A" },
                    { label: "Exhaust Gas Temp", value: entry.exhaustGasTemp ?? "N/A" },
                  ]}
                />
              )}

              <SectionBar title="ETA Next Port" />
              <Row
                pairs={[
                  { label: "Date", value: fmtDate(entry.etaNextPortDate) },
                  { label: "Time", value: entry.etaNextPortTime ?? "N/A" },
                ]}
              />
              <Row pairs={[{ label: "ZD", value: entry.etaNextPortZd ?? "N/A", span: 3 }]} />
            </tbody>
          </table>

          {isDeparture && portStayDiscrepancy && (
            <div className="mt-2 flex items-start gap-2.5 rounded-md border border-warning bg-warning/10 px-4 py-3 text-sm text-warning print:border print:bg-transparent">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p>
                  <span className="font-medium">Port Stay hours don&apos;t add up.</span> Crew-reported entries since
                  Arrival sum to {fmtNum(portStayDiscrepancy.reported, 1)} HRS, but the computed elapsed time is{" "}
                  {fmtNum(totalPortStayHrs, 1)} HRS — a difference of {fmtNum(portStayDiscrepancy.diff, 1)} HRS.
                </p>
                <p className="mt-1.5">
                  <span className="font-medium">What to check:</span> open each report covering this port call and
                  confirm its Report Time and Port Stay (hrs) — a skipped day (no report at all) will also show up
                  as a gap here.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      <table className="mt-[-1px] w-full border-collapse text-sm">
        <thead>
          <tr>
            <td colSpan={2} className="border border-border bg-muted/40 px-3 py-1.5 font-semibold">
              &nbsp;
            </td>
            <td className="border border-border bg-muted/60 px-3 py-1.5 text-center font-bold uppercase tracking-wide">Previous</td>
            <td className="border border-border bg-muted/60 px-3 py-1.5 text-center font-bold uppercase tracking-wide">Received</td>
            <td className="border border-border bg-muted/60 px-3 py-1.5 text-center font-bold uppercase tracking-wide">ROB</td>
            <td className="border border-border bg-muted/60 px-3 py-1.5 text-center font-bold uppercase tracking-wide">Consumed</td>
          </tr>
        </thead>
        <tbody>
          {BUNKER_GROUPS.map((group) =>
            group.grades.map((grade, i) => {
              const row = bunkerByGrade.get(grade);
              return (
                <tr key={grade}>
                  {group.category ? (
                    <>
                      {i === 0 && (
                        <td
                          rowSpan={group.grades.length}
                          className="border border-border bg-muted/20 px-3 py-1.5 align-middle text-sm font-semibold"
                        >
                          {group.category}
                        </td>
                      )}
                      <td className="border border-border px-3 py-1.5 text-sm">{gradeLabel(grade)}</td>
                    </>
                  ) : (
                    <td colSpan={2} className="border border-border px-3 py-1.5 text-sm font-semibold">
                      {gradeLabel(grade)}
                    </td>
                  )}
                  <td className="border border-border px-3 py-1.5 text-right text-sm tabular-nums">{fmtNum(row?.previous ?? null)}</td>
                  <td className="border border-border px-3 py-1.5 text-right text-sm tabular-nums">{fmtNum(row?.received ?? null)}</td>
                  <td className="border border-border px-3 py-1.5 text-right text-sm tabular-nums">{fmtNum(row?.rob ?? null)}</td>
                  <td className="border border-border px-3 py-1.5 text-right text-sm tabular-nums">{fmtNum(row?.consumed ?? null)}</td>
                </tr>
              );
            }),
          )}
        </tbody>
      </table>

      <table className="mt-[-1px] w-full border-collapse">
        <tbody>
          <Row
            pairs={[
              { label: "Type of Cargo Onboard", value: entry.cargoOnboard ?? "N/A" },
              { label: "Cargo to Disc / Loaded", value: entry.cargoToDiscLoaded ?? "N/A" },
            ]}
          />
          <Row
            pairs={[
              { label: "BL Quantity", value: entry.blQuantity != null ? String(entry.blQuantity) : "N/A" },
              { label: "Cargo Temp B-M-T", value: entry.cargoTemp ?? "N/A" },
            ]}
          />

          <SectionBar title="Agent" />
          <Row
            pairs={[
              { label: "Name", value: entry.agentName ?? "N/A" },
              { label: "Tel", value: entry.agentTel ?? "N/A" },
            ]}
          />
          <Row
            pairs={[
              { label: "Fax", value: entry.agentFax ?? "N/A" },
              { label: "Email", value: entry.agentEmail ?? "N/A" },
            ]}
          />
          <Row pairs={[{ label: "Address", value: entry.agentAddress ?? "N/A", span: 3 }]} />
        </tbody>
      </table>

      {(entry.deckDeptReport || entry.engineDeptReport) && (
        <div className="mt-4 space-y-3 border border-border p-3">
          <div className="text-sm font-bold uppercase tracking-wide">Daily Working Report</div>
          {entry.deckDeptReport && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground">Deck Dept.</div>
              <p className="whitespace-pre-wrap text-sm">{entry.deckDeptReport}</p>
            </div>
          )}
          {entry.engineDeptReport && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground">Engine Dept.</div>
              <p className="whitespace-pre-wrap text-sm">{entry.engineDeptReport}</p>
            </div>
          )}
        </div>
      )}

      {entry.statementOfFacts && (
        <div className="mt-4 space-y-1 border border-border p-3">
          <div className="text-sm font-bold uppercase tracking-wide">Statement of Facts</div>
          <p className="whitespace-pre-wrap text-sm">{entry.statementOfFacts}</p>
        </div>
      )}

      {entry.remarks && (
        <div className="mt-4 space-y-1 border border-border p-3">
          <div className="text-sm font-bold uppercase tracking-wide">Remarks</div>
          <p className="whitespace-pre-wrap text-sm">{entry.remarks}</p>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-8">
        <div>
          <div className="text-xs font-semibold text-muted-foreground">Master</div>
          <div className="mt-6 border-t border-border pt-1 text-sm">{entry.master ?? "N/A"}</div>
        </div>
        <div>
          <div className="text-xs font-semibold text-muted-foreground">Chief Engineer</div>
          <div className="mt-6 border-t border-border pt-1 text-sm">{entry.chiefEngineer ?? "N/A"}</div>
        </div>
      </div>
    </div>
  );
}
