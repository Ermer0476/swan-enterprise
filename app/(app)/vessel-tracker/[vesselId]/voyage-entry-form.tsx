"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle } from "lucide-react";
import {
  addVoyageLogAction,
  updateVoyageLogAction,
  type ActionResult,
} from "@/features/vessel-tracker/actions";
import {
  VOYAGE_REPORT_TYPES,
  VOYAGE_REPORT_TYPE_LABELS,
  VESSEL_TRACKER_STATUSES,
  VESSEL_TRACKER_STATUS_LABELS,
  LADEN_STATES,
  LADEN_STATE_LABELS,
  ENGINE_ORDERS,
  ENGINE_ORDER_LABELS,
  BUNKER_GRADES,
  ENTRY_FORM_BUNKER_GRADES,
  BUNKER_GRADE_LABELS,
  bunkerFieldName,
  reportDateTimeMs,
  type BunkerGradeValue,
  type VoyageReportTypeValue,
  type VesselTrackerStatusValue,
} from "@/features/vessel-tracker/schema";
import { Input, Label, Select, AutoGrowInput } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type BunkerRowDefaults = { previous: string; received: string; rob: string };
const BLANK_BUNKER_ROW: BunkerRowDefaults = { previous: "", received: "", rob: "" };

export type VoyageEntryDefaults = {
  entryId?: string;
  date: string; // yyyy-mm-dd
  voyageNo: string;
  reportType: string;
  vesselStatus: string;
  ladenState: string;
  engineOrder: string;
  steamingTimeHrs: string;
  obsSpeedKn: string;
  meSpeedKn: string;
  rpm: string;
  slipPct: string;
  beaufortScale: string;
  portStayHrs: string;
  totalPortStayHrs: string;
  offHireHrs: string;

  fromPort: string;
  nextPort: string;
  course: string;
  zoneDescription: string;
  reportTimeLocal: string;
  position: string;
  draftFwdM: string;
  draftAftM: string;
  draftMeanM: string;

  distanceRunNm: string;
  totalDistanceRunNm: string;
  dtgNextPortNm: string;
  totalSteamingTimeHrs: string;
  distanceLogNm: string;
  generalAvgSpeedKn: string;
  engineDistanceNm: string;
  totalEngineDistanceNm: string;
  generalAvgEngineSpeedKn: string;
  weatherCondition: string;
  generalAvgSlipPct: string;
  barometer: string;
  exhaustTempUnit: string;
  exhaustGasTemp: string;

  etaNextPortDate: string;
  etaNextPortTime: string;
  etaNextPortZd: string;

  cargoOnboard: string;
  cargoToDiscLoaded: string;
  blQuantity: string;
  cargoTemp: string;
  agentName: string;
  agentTel: string;
  agentFax: string;
  agentEmail: string;
  agentAddress: string;
  deckDeptReport: string;
  engineDeptReport: string;
  statementOfFacts: string;
  master: string;
  chiefEngineer: string;
  bunker: Partial<Record<BunkerGradeValue, BunkerRowDefaults>>;

  remarks: string;
};

export const BLANK_VOYAGE_ENTRY: VoyageEntryDefaults = {
  date: "",
  voyageNo: "",
  reportType: "NOON_AT_SEA",
  vesselStatus: "SAILING",
  ladenState: "LADEN",
  engineOrder: "NORMAL_STEAMING",
  steamingTimeHrs: "",
  obsSpeedKn: "",
  meSpeedKn: "",
  rpm: "",
  slipPct: "",
  beaufortScale: "",
  portStayHrs: "",
  totalPortStayHrs: "",
  offHireHrs: "",

  fromPort: "",
  nextPort: "",
  course: "",
  zoneDescription: "",
  // Matches the default reportType above (Noon Position, taken at noon by
  // definition) — pre-filled so a brand-new entry doesn't start with the
  // one value the elapsed-time discrepancy checks most depend on left
  // blank.
  reportTimeLocal: "1200H",
  position: "",
  draftFwdM: "",
  draftAftM: "",
  draftMeanM: "",

  distanceRunNm: "",
  totalDistanceRunNm: "",
  dtgNextPortNm: "",
  totalSteamingTimeHrs: "",
  distanceLogNm: "",
  generalAvgSpeedKn: "",
  engineDistanceNm: "",
  totalEngineDistanceNm: "",
  generalAvgEngineSpeedKn: "",
  weatherCondition: "",
  generalAvgSlipPct: "",
  barometer: "",
  exhaustTempUnit: "",
  exhaustGasTemp: "",

  etaNextPortDate: "",
  etaNextPortTime: "",
  etaNextPortZd: "",

  cargoOnboard: "",
  cargoToDiscLoaded: "",
  blQuantity: "",
  cargoTemp: "",
  agentName: "",
  agentTel: "",
  agentFax: "",
  agentEmail: "",
  agentAddress: "",
  deckDeptReport: "",
  engineDeptReport: "",
  statementOfFacts: "",
  master: "",
  chiefEngineer: "",
  bunker: {},

  remarks: "",
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

function Section({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  return (
    <details className="group rounded-md border border-border" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <span className="text-xs font-normal text-muted-foreground group-open:hidden">Click to expand</span>
      </summary>
      <div className="space-y-4 border-t border-border p-3">{children}</div>
    </details>
  );
}

/** Horizontal label + control row for compact "data-entry table" sections
 * (Voyage / Performance box, Vessel Status/State/Engine Order row) — label
 * and control share one line instead of stacking, so each metric takes
 * one row instead of two. */
function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      <Label className="w-32 shrink-0 text-xs leading-tight sm:w-[9.5rem]">{label}</Label>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** Read-only, system-calculated value in the same FieldRow shape as an
 * editable field — a shaded box instead of an input is the only signal
 * needed that this isn't for the crew to type, so no explanatory sentence
 * underneath is needed either. */
function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <FieldRow label={label}>
      <div className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">{value || "—"}</div>
    </FieldRow>
  );
}

/** Two FieldRows side by side (Last 24 Hours vs Voyage To Date, or any
 * other paired fields) — stacks to one column on narrow screens. */
function PairedRow({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y-0">
      <div>{left}</div>
      <div>{right}</div>
    </div>
  );
}

/** A numeric input with its unit shown as an attached suffix chip, instead
 * of spelling the unit out in the label — reads closer to a real
 * instrument dial and keeps the label itself short. Label-less so it drops
 * straight into a FieldRow's content slot. */
function UnitInput({
  name,
  defaultValue,
  value,
  onChange,
  readOnly,
  unit,
}: {
  name: string;
  defaultValue?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  readOnly?: boolean;
  unit: string;
}) {
  return (
    <div className="flex">
      <Input
        type="number"
        step="any"
        name={name}
        readOnly={readOnly}
        className={`rounded-r-none ${readOnly ? "bg-muted text-muted-foreground" : ""}`}
        {...(value !== undefined ? { value, onChange } : { defaultValue })}
      />
      <span className="flex items-center rounded-r-md border border-l-0 border-input bg-muted px-3 text-sm text-muted-foreground">{unit}</span>
    </div>
  );
}

/** Report Time is free text like "0800H" or "1430" — pull out the first
 * HH:MM-ish run of digits; falls back to midnight if it doesn't parse
 * (e.g. blank, "N/A"), which just costs ETA some hour-of-day precision. */
function parseReportTime(input: string): { h: number; mi: number } {
  const m = /(\d{1,2}):?(\d{2})/.exec(input);
  if (!m) return { h: 0, mi: 0 };
  return { h: Math.min(23, Number(m[1])), mi: Math.min(59, Number(m[2])) };
}

/** Departure ETA is a rough estimate, not a real reading — the vessel hasn't
 * sailed yet, so Speed here is an assumed/planned figure (typical service
 * speed) the crew supplies just so there's *some* basis for an expected
 * arrival at the next port. ETA = this report's own timestamp (Date +
 * Report Time) plus distance-to-go / that assumed speed. Built via local
 * Date getters/setters only, never `toISOString()`, to avoid the
 * naive-string UTC-shift bug already hit elsewhere in this form. */
function computeEtaFromDeparture(reportDate: string, reportTimeLocal: string, dtgNm: string, speedKn: string): { date: string; time: string } | null {
  if (!reportDate) return null;
  const { h, mi } = parseReportTime(reportTimeLocal);
  const pad = (n: number) => String(n).padStart(2, "0");
  const start = new Date(`${reportDate}T${pad(h)}:${pad(mi)}`).getTime();
  if (Number.isNaN(start)) return null;

  const dtg = Number(dtgNm);
  const speed = Number(speedKn);
  if (!Number.isFinite(dtg) || dtg <= 0 || !Number.isFinite(speed) || speed <= 0) return null;

  const eta = new Date(start + (dtg / speed) * 3_600_000);
  return {
    date: `${eta.getFullYear()}-${pad(eta.getMonth() + 1)}-${pad(eta.getDate())}`,
    time: `${pad(eta.getHours())}:${pad(eta.getMinutes())}H`,
  };
}

export type BunkerRobSnapshot = {
  date: string;
  reportType: VoyageReportTypeValue;
  robByGrade: Partial<Record<BunkerGradeValue, number>>;
};

/** Sum of every entry saved so far in the target voyage — the base the
 * Voyage-to-Date column previews live from as the crew types (mirrors
 * getVoyageCumulativeTotals in features/vessel-tracker/queries.ts, which
 * recomputes the authoritative version server-side at save time). */
export type VoyageCumulativeTotals = {
  totalDistanceRunNm: number;
  totalSteamingTimeHrs: number;
  totalEngineDistanceNm: number;
  priorSlipPctSum: number;
  priorSlipPctCount: number;
  /** The voyage's last Arrival report — Total Time in Port is measured from
   * here (this entry's own Date+Report Time minus the Arrival's), not
   * summed from every While-in-Port entry's portStayHrs. null when there's
   * no Arrival yet in this voyage to anchor to. */
  lastArrival: { date: string; reportTimeLocal: string | null } | null;
  /** The entry logged immediately before this one (any report type) — Port
   * Stay (hrs) for this entry is measured from here, so the daily figure and
   * the Arrival-anchored total above always telescope consistently. null
   * when this is the first entry ever logged for the vessel. */
  previousEntry: { date: string; reportTimeLocal: string | null } | null;
  /** The most recent non-"While in Port" entry (Departure, previous Noon
   * Position, or an Arrival) — Steaming Time (hrs) for a Noon Position or
   * Arrival report is measured from here, same telescoping idea as
   * previousEntry above for Port Stay. null when this is the first sailing
   * report ever logged for the vessel. */
  previousSailingReport: { date: string; reportTimeLocal: string | null } | null;
};

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `date` is a plain "YYYY-MM-DD" string — read the digits directly rather
 * than through `new Date(...)`, which would parse it as UTC midnight and
 * risks shifting the displayed day in a negative-UTC-offset timezone. */
function formatShortDate(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  const [, , mo, d] = m;
  return `${SHORT_MONTHS[Number(mo) - 1]} ${Number(d)}`;
}

function BunkerLedgerTable({
  bunkerDefaults,
  previousRob,
  avgConsumed,
  robHistory,
  isEdit,
}: {
  bunkerDefaults: VoyageEntryDefaults["bunker"];
  previousRob: Partial<Record<BunkerGradeValue, number>>;
  avgConsumed: Partial<Record<BunkerGradeValue, number>>;
  robHistory: BunkerRobSnapshot[];
  isEdit: boolean;
}) {
  const [values, setValues] = useState<Record<BunkerGradeValue, { previous: string; received: string; rob: string }>>(() => {
    const init = {} as Record<BunkerGradeValue, { previous: string; received: string; rob: string }>;
    for (const grade of BUNKER_GRADES) {
      const row = bunkerDefaults[grade] ?? BLANK_BUNKER_ROW;
      init[grade] = { previous: row.previous, received: row.received, rob: row.rob };
    }
    return init;
  });
  // "" = each grade's own auto-carried-forward value; "manual" = crew types
  // every grade's Previous by hand; anything else is a robHistory index —
  // picking a past report fills every grade's Previous at once from that
  // one report, instead of the crew choosing grade-by-grade.
  const [selectedSnapshot, setSelectedSnapshot] = useState("");

  function setField(grade: BunkerGradeValue, field: "previous" | "received" | "rob", value: string) {
    setValues((prev) => ({ ...prev, [grade]: { ...prev[grade], [field]: value } }));
  }

  const isManual = selectedSnapshot === "manual";
  const snapshot = selectedSnapshot !== "" && !isManual ? robHistory[Number(selectedSnapshot)] : null;

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Grade</th>
            <th className="px-3 py-2 font-medium">
              <div className="flex items-center gap-2">
                <span>Previous</span>
                <Select
                  value={selectedSnapshot}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (next === "manual") {
                      // Seed each grade's manual box with whatever was
                      // showing a moment ago (auto or the snapshot just
                      // switched away from) — the crew only has to retype
                      // the grades that actually differ, not all of them.
                      setValues((prev) => {
                        const seeded = { ...prev };
                        for (const grade of BUNKER_GRADES) {
                          const storedPrevious = isEdit ? bunkerDefaults[grade]?.previous : undefined;
                          const auto = isEdit
                            ? storedPrevious && storedPrevious !== "" ? Number(storedPrevious) : null
                            : (previousRob[grade] ?? null);
                          const fromSnapshot = selectedSnapshot !== "" ? robHistory[Number(selectedSnapshot)] : null;
                          const current = fromSnapshot ? (fromSnapshot.robByGrade[grade] ?? auto) : auto;
                          seeded[grade] = { ...seeded[grade], previous: current != null ? String(current) : "" };
                        }
                        return seeded;
                      });
                    }
                    setSelectedSnapshot(next);
                  }}
                  className="h-7 min-w-[11rem] text-xs font-normal normal-case"
                >
                  <option value="">Last ROB per grade (auto)</option>
                  <option value="manual">Manual Input</option>
                  {robHistory.map((h, i) => (
                    <option key={i} value={String(i)}>
                      {formatShortDate(h.date)} · {VOYAGE_REPORT_TYPE_LABELS[h.reportType]}
                    </option>
                  ))}
                </Select>
              </div>
            </th>
            <th className="px-3 py-2 font-medium">Received</th>
            <th className="px-3 py-2 font-medium">Current ROB</th>
            <th className="px-3 py-2 font-medium">Consumed (auto)</th>
          </tr>
        </thead>
        <tbody>
          {ENTRY_FORM_BUNKER_GRADES.map((grade) => {
            // Edit mode reuses this entry's OWN original Previous snapshot —
            // never re-fetched, so correcting a later field doesn't rewrite
            // this entry's place in the ROB chain. Create mode uses the
            // fleet's actual last-saved ROB for this vessel+grade. Either
            // way, picking a report in the header above (e.g. the vessel's
            // own Arrival report for a Departure report) overrides every
            // grade's Previous from that one report at once; a grade the
            // chosen report didn't record falls back to its own auto value.
            const storedPrevious = isEdit ? bunkerDefaults[grade]?.previous : undefined;
            const autoPrevious = isEdit
              ? storedPrevious && storedPrevious !== "" ? Number(storedPrevious) : null
              : (previousRob[grade] ?? null);
            const manualRaw = values[grade].previous;
            const previousNum = isManual
              ? (manualRaw === "" ? null : Number(manualRaw))
              : snapshot
                ? (snapshot.robByGrade[grade] ?? autoPrevious)
                : autoPrevious;

            const receivedRaw = values[grade].received;
            const robRaw = values[grade].rob;
            const receivedNum = receivedRaw === "" ? 0 : Number(receivedRaw);
            const robNum = robRaw === "" ? null : Number(robRaw);
            const consumed = previousNum != null && robNum != null && !Number.isNaN(receivedNum) && !Number.isNaN(robNum) ? previousNum + receivedNum - robNum : null;
            const negative = consumed != null && consumed < 0;
            const avg = avgConsumed[grade];
            const unusuallyHigh = !negative && consumed != null && avg != null && avg > 0 && consumed > avg * 2;

            return (
              <tr key={grade} className="border-b border-border align-top last:border-0">
                <td className="whitespace-nowrap px-3 py-2 text-xs font-medium">{BUNKER_GRADE_LABELS[grade]}</td>
                <td className="px-2 py-1.5">
                  {isManual ? (
                    <Input
                      type="number"
                      step="any"
                      name={bunkerFieldName(grade, "previous")}
                      value={manualRaw}
                      onChange={(e) => setField(grade, "previous", e.target.value)}
                      className="h-8"
                    />
                  ) : (
                    <>
                      <input type="hidden" name={bunkerFieldName(grade, "previous")} value={previousNum ?? ""} />
                      <div className="flex h-8 w-full items-center rounded-md border border-input bg-muted px-2 text-xs text-muted-foreground">{previousNum ?? "—"}</div>
                    </>
                  )}
                </td>
                <td className="px-2 py-1.5">
                  <Input
                    type="number"
                    step="any"
                    name={bunkerFieldName(grade, "received")}
                    value={receivedRaw}
                    onChange={(e) => setField(grade, "received", e.target.value)}
                    className="h-8"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Input
                    type="number"
                    step="any"
                    name={bunkerFieldName(grade, "rob")}
                    value={robRaw}
                    onChange={(e) => setField(grade, "rob", e.target.value)}
                    className="h-8"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <div
                    className={`flex h-8 items-center rounded-md border px-2 text-xs tabular-nums ${
                      negative ? "border-danger bg-danger/10 text-danger" : "border-input bg-muted text-muted-foreground"
                    }`}
                  >
                    {consumed != null ? consumed.toFixed(2) : "—"}
                  </div>
                  {negative && (
                    <p className="mt-1 max-w-[10rem] text-xs text-danger">
                      Current ROB is greater than available ROB. Please verify ROB / Bunker Received.
                    </p>
                  )}
                  {unusuallyHigh && <p className="mt-1 max-w-[10rem] text-xs text-warning">Higher than usual consumption — please verify.</p>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {/* Fresh Water Production is no longer collected in this form, but a
          handful of older entries still carry a saved value for it — these
          hidden fields carry that value through unchanged on save instead of
          silently deleting it (bunker rows are fully replaced on every
          save, so a grade with no submitted fields at all is dropped). */}
      {(() => {
        const fw = bunkerDefaults.FRESH_WATER_PRODUCTION ?? BLANK_BUNKER_ROW;
        return (
          <>
            <input type="hidden" name={bunkerFieldName("FRESH_WATER_PRODUCTION", "previous")} value={fw.previous} />
            <input type="hidden" name={bunkerFieldName("FRESH_WATER_PRODUCTION", "received")} value={fw.received} />
            <input type="hidden" name={bunkerFieldName("FRESH_WATER_PRODUCTION", "rob")} value={fw.rob} />
          </>
        );
      })()}
    </div>
  );
}

export function VoyageEntryForm({
  vesselId,
  defaults: rawDefaults,
  carryForward,
  previousRob = {},
  avgConsumed = {},
  robHistory = [],
  voyageCumulative,
  previousSailingReportDtg,
  onSuccess,
  onCancel,
}: {
  vesselId: string;
  defaults: VoyageEntryDefaults;
  // A separate prop (not pre-merged by the caller) — merging BLANK_VOYAGE_ENTRY
  // via object-spread on the server side breaks silently, since spreading a
  // "use client" module's export outside of a JSX prop position doesn't
  // enumerate its real keys (only passing it through untouched does). Doing
  // the merge here, inside the client module, is safe.
  carryForward?: Partial<VoyageEntryDefaults>;
  previousRob?: Partial<Record<BunkerGradeValue, number>>;
  avgConsumed?: Partial<Record<BunkerGradeValue, number>>;
  robHistory?: BunkerRobSnapshot[];
  // Fetched for both Add and Edit — the sum of everything already saved in
  // this voyage BEFORE this entry's own position (see the type's own doc
  // comment), used to live-preview Port Stay, Steaming Time, DTG, and the
  // Voyage/Performance totals as the crew types, instead of only showing
  // the correct figure after they click Save. Scoped strictly before this
  // row's own (date, createdAt) in Edit mode specifically so it can never
  // include this same row's own already-saved contribution — no double
  // counting risk, since a `before` cutoff already excludes it server-side
  // too (features/vessel-tracker/actions.ts, toDataFields). Left undefined
  // only when the caller has nothing to fetch it from.
  voyageCumulative?: VoyageCumulativeTotals;
  // The DTG on file for the most recent Departure/Noon/Arrival report
  // BEFORE this one — a pure lookup (not a cumulative that would double
  // count), so unlike voyageCumulative it's safe to fetch and pass in both
  // Add and Edit mode. Lets DTG's own live carry-forward preview stay
  // correct even when re-opening an entry for edit after an earlier one in
  // the chain changed, instead of only showing whatever was stale-saved
  // on this row the last time it was submitted.
  previousSailingReportDtg?: number | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const defaults = carryForward ? { ...rawDefaults, ...carryForward } : rawDefaults;
  const isEdit = !!defaults.entryId;
  const action = isEdit ? updateVoyageLogAction : addVoyageLogAction;
  const [state, formAction] = useActionState<ActionResult, FormData>(action, { ok: false, error: null });
  const formRef = useRef<HTMLFormElement>(null);

  const [reportType, setReportType] = useState<VoyageReportTypeValue>(defaults.reportType as VoyageReportTypeValue);
  const [vesselStatus, setVesselStatus] = useState<VesselTrackerStatusValue>(defaults.vesselStatus as VesselTrackerStatusValue);
  const [reportDate, setReportDate] = useState(defaults.date);
  const [reportTimeLocal, setReportTimeLocal] = useState(defaults.reportTimeLocal);
  // Departure's own DTG box only — a genuinely fresh reading with nothing
  // before it in this passage to compute from, so it stays a manual entry.
  // Noon/Arrival's DTG is fully computed (see dtgAutoValue below).
  const [dtgNextPortNm, setDtgNextPortNm] = useState(defaults.dtgNextPortNm);
  const [etaSpeedKn, setEtaSpeedKn] = useState(defaults.obsSpeedKn);
  const [draftFwdM, setDraftFwdM] = useState(defaults.draftFwdM);
  const [draftAftM, setDraftAftM] = useState(defaults.draftAftM);
  const [distanceRunNm, setDistanceRunNm] = useState(defaults.distanceRunNm);
  const [engineDistanceNm, setEngineDistanceNm] = useState(defaults.engineDistanceNm);
  const [cargoOnboard, setCargoOnboard] = useState(defaults.cargoOnboard);
  const [statementOfFacts, setStatementOfFacts] = useState(defaults.statementOfFacts);
  const [showDepartureAlert, setShowDepartureAlert] = useState(false);

  const isPortOnly = reportType === "IN_PORT";
  const isNoon = reportType === "NOON_AT_SEA";
  // On Departure the vessel hasn't sailed yet this reporting period — every
  // speed/distance/consumption figure below is genuinely not-yet-known, so
  // showing all of them just adds fields crew have to skip past. Only
  // Distance To Go is meaningful before getting underway.
  const isDeparture = reportType === "DEPARTURE";

  // Departure is the last chance to record what's actually onboard and what
  // happened in port before the vessel sails — both routinely get skipped
  // since neither blocks any other field. Flagged here (banner + popup) as
  // a nudge; features/vessel-tracker/actions.ts enforces the same rule
  // server-side as the actual gate.
  const missingDepartureFields = isDeparture
    ? ([
        cargoOnboard.trim() === "" ? "Type of Cargo Onboard" : null,
        statementOfFacts.trim() === "" ? "Statement of Facts" : null,
      ].filter(Boolean) as string[])
    : [];

  const computedEta = useMemo(
    () => (isDeparture ? computeEtaFromDeparture(reportDate, reportTimeLocal, dtgNextPortNm, etaSpeedKn) : null),
    [isDeparture, reportDate, reportTimeLocal, dtgNextPortNm, etaSpeedKn],
  );
  const draftMeanM = useMemo(() => {
    const f = Number(draftFwdM);
    const a = Number(draftAftM);
    if (draftFwdM === "" || draftAftM === "" || !Number.isFinite(f) || !Number.isFinite(a)) return null;
    return (f + a) / 2;
  }, [draftFwdM, draftAftM]);
  // Steaming Time (hrs) is no longer typed — elapsed time since the last
  // report that wasn't filed While in Port (Departure, the previous Noon
  // Position, or an Arrival), same anchor the server uses
  // (getPreviousSailingReport in features/vessel-tracker/queries.ts).
  const steamingTimeHrsLive = useMemo(() => {
    if (!voyageCumulative?.previousSailingReport || !reportDate) return null;
    const startMs = reportDateTimeMs(voyageCumulative.previousSailingReport.date, voyageCumulative.previousSailingReport.reportTimeLocal);
    const endMs = reportDateTimeMs(reportDate, reportTimeLocal);
    return (endMs - startMs) / 3_600_000;
  }, [voyageCumulative, reportDate, reportTimeLocal]);
  // Falls back to this entry's own already-saved value only when there's
  // truly no previous sailing report to anchor on (the very first one ever
  // logged for this vessel) — voyageCumulative is fetched in both Add and
  // Edit mode now, so this live figure updates immediately as the crew
  // types instead of only showing the correct value after Save.
  const effectiveSteamingTimeHrs = useMemo(() => {
    if (steamingTimeHrsLive != null) return steamingTimeHrsLive;
    const saved = Number(defaults.steamingTimeHrs);
    return defaults.steamingTimeHrs !== "" && Number.isFinite(saved) ? saved : null;
  }, [steamingTimeHrsLive, defaults.steamingTimeHrs]);
  const obsSpeedKn = useMemo(() => {
    const dist = Number(distanceRunNm);
    if (distanceRunNm === "" || effectiveSteamingTimeHrs == null || !Number.isFinite(dist) || effectiveSteamingTimeHrs === 0) return null;
    return dist / effectiveSteamingTimeHrs;
  }, [distanceRunNm, effectiveSteamingTimeHrs]);

  // Standard nautical Slip % = (Engine Distance − Dist Run) / Engine
  // Distance × 100 — both inputs are already on the form, same as Observed
  // Speed, so no reason to make the crew compute it themselves. Matches
  // the server's own fallback-free formula (features/vessel-tracker/
  // actions.ts, toDataFields) once both figures are on hand.
  const effectiveSlipPct = useMemo(() => {
    const dist = Number(distanceRunNm);
    const eng = Number(engineDistanceNm);
    if (distanceRunNm === "" || engineDistanceNm === "" || !Number.isFinite(dist) || !Number.isFinite(eng) || eng === 0) return null;
    return ((eng - dist) / eng) * 100;
  }, [distanceRunNm, engineDistanceNm]);

  // Distance To Go (Noon/Arrival only — Departure keeps its own manual box
  // above, a genuinely fresh reading with nothing before it in this passage
  // to compute from) — no longer typed, same telescoping idea as Port Stay
  // and Steaming Time: the previous Departure/Noon/Arrival report's own DTG
  // minus THIS entry's own Dist Run, computed server-side at save time
  // (features/vessel-tracker/actions.ts, computeChainedFields) and
  // cascaded forward automatically whenever an earlier entry in the chain
  // changes. Fetched fresh (previousSailingReportDtg) in both Add and Edit
  // mode, rather than read off `defaults.dtgNextPortNm` — the same
  // already-saved-on-this-row value that used to leave DTG looking
  // unchanged after a correction further up the chain.
  const dtgAutoValue = useMemo(() => {
    if (isDeparture || previousSailingReportDtg == null) return null;
    const dist = Number(distanceRunNm);
    const distDelta = distanceRunNm !== "" && Number.isFinite(dist) ? dist : 0;
    return previousSailingReportDtg - distDelta;
  }, [isDeparture, previousSailingReportDtg, distanceRunNm]);
  const effectiveDtgNextPortNm = useMemo(() => {
    if (dtgAutoValue != null) return dtgAutoValue;
    const saved = Number(defaults.dtgNextPortNm);
    return defaults.dtgNextPortNm !== "" && Number.isFinite(saved) ? saved : null;
  }, [dtgAutoValue, defaults.dtgNextPortNm]);

  // Voyage-to-Date preview — live in both Add and Edit mode now that
  // voyageCumulative is fetched for both (see the prop's doc comment
  // above); falls back to whatever this row's own last save already
  // computed only if voyageCumulative genuinely isn't available.
  const totalDistanceRunNmLive = useMemo(() => {
    if (!voyageCumulative) return null;
    const dist = Number(distanceRunNm);
    return voyageCumulative.totalDistanceRunNm + (distanceRunNm !== "" && Number.isFinite(dist) ? dist : 0);
  }, [voyageCumulative, distanceRunNm]);
  const totalSteamingTimeHrsLive = useMemo(() => {
    if (!voyageCumulative) return null;
    return voyageCumulative.totalSteamingTimeHrs + (effectiveSteamingTimeHrs ?? 0);
  }, [voyageCumulative, effectiveSteamingTimeHrs]);
  const totalEngineDistanceNmLive = useMemo(() => {
    if (!voyageCumulative) return null;
    const eng = Number(engineDistanceNm);
    return voyageCumulative.totalEngineDistanceNm + (engineDistanceNm !== "" && Number.isFinite(eng) ? eng : 0);
  }, [voyageCumulative, engineDistanceNm]);
  // Total Time in Port previews as elapsed time from the voyage's last
  // Arrival to THIS entry's own Date + Report Time — not a running sum of
  // portStayHrs — so an earlier, already-closed port call can never bleed
  // its hours into a new one that started after a later Arrival.
  const totalPortStayHrsLive = useMemo(() => {
    if (!voyageCumulative?.lastArrival || !reportDate) return null;
    const startMs = reportDateTimeMs(voyageCumulative.lastArrival.date, voyageCumulative.lastArrival.reportTimeLocal);
    const endMs = reportDateTimeMs(reportDate, reportTimeLocal);
    return (endMs - startMs) / 3_600_000;
  }, [voyageCumulative, reportDate, reportTimeLocal]);
  // Port Stay (hrs) itself is no longer typed — elapsed time since whatever
  // entry was logged immediately before this one (any type), same anchor
  // the server uses (getPreviousEntry in features/vessel-tracker/queries.ts).
  const portStayHrsLive = useMemo(() => {
    if (!voyageCumulative?.previousEntry || !reportDate) return null;
    const startMs = reportDateTimeMs(voyageCumulative.previousEntry.date, voyageCumulative.previousEntry.reportTimeLocal);
    const endMs = reportDateTimeMs(reportDate, reportTimeLocal);
    return (endMs - startMs) / 3_600_000;
  }, [voyageCumulative, reportDate, reportTimeLocal]);
  const generalAvgSpeedKnLive = useMemo(
    () => (totalDistanceRunNmLive != null && totalSteamingTimeHrsLive != null && totalSteamingTimeHrsLive > 0 ? totalDistanceRunNmLive / totalSteamingTimeHrsLive : null),
    [totalDistanceRunNmLive, totalSteamingTimeHrsLive],
  );
  const generalAvgEngineSpeedKnLive = useMemo(
    () =>
      totalEngineDistanceNmLive != null && totalSteamingTimeHrsLive != null && totalSteamingTimeHrsLive > 0
        ? totalEngineDistanceNmLive / totalSteamingTimeHrsLive
        : null,
    [totalEngineDistanceNmLive, totalSteamingTimeHrsLive],
  );
  const generalAvgSlipPctLive = useMemo(() => {
    if (!voyageCumulative) return null;
    const count = voyageCumulative.priorSlipPctCount + (effectiveSlipPct != null ? 1 : 0);
    if (count === 0) return null;
    return (voyageCumulative.priorSlipPctSum + (effectiveSlipPct ?? 0)) / count;
  }, [voyageCumulative, effectiveSlipPct]);

  useEffect(() => {
    if (state.ok) {
      if (!isEdit) formRef.current?.reset();
      onSuccess?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={(e) => {
        if (missingDepartureFields.length > 0) {
          e.preventDefault();
          setShowDepartureAlert(true);
        }
      }}
      // @container: the 3-column grids below size off the FORM's own
      // rendered width, not the viewport — a viewport breakpoint (md:) can't
      // tell the difference between "wide window, sidebar open" and
      // "narrow window, sidebar open," and the latter was squeezing 3
      // columns into a space too narrow to hold them (labels overlapping
      // inputs). Container queries measure the space this form actually has.
      className="@container space-y-4"
    >
      <input type="hidden" name="vesselId" value={vesselId} />
      {isEdit && <input type="hidden" name="entryId" value={defaults.entryId} />}

      {missingDepartureFields.length > 0 && (
        // Stays up for as long as the fields are missing — re-evaluated on
        // every render, not dismissible, since a Departure report is
        // genuinely incomplete without these and the crew shouldn't be able
        // to make the reminder disappear without actually filling them in.
        <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>
            <span className="font-medium">Required before this Departure report can be saved:</span> {missingDepartureFields.join(" and ")}.
          </span>
        </div>
      )}

      {isEdit && (
        // The full form runs long (16 sections) — a top action bar means
        // Save/Cancel are visible right away instead of only after
        // scrolling past everything, which is where this button used to
        // hide when editing a row inline in the table.
        <div className="sticky top-0 z-10 -mx-3 flex items-center gap-2 border-b border-border bg-card/95 px-3 py-2 backdrop-blur">
          <SubmitButton label="Save changes" />
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
          {state.error && (
            <p className="text-sm text-danger" role="alert">
              {state.error}
            </p>
          )}
        </div>
      )}

      <Section title="Report Information" defaultOpen>
        <div className="grid grid-cols-1 divide-y divide-border rounded-md border border-border @[820px]:grid-cols-3 @[820px]:divide-x @[820px]:divide-y-0">
          <FieldRow label="Date">
            <Input type="date" name="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} required />
          </FieldRow>
          <FieldRow label="Voy No.">
            <Input name="voyageNo" defaultValue={defaults.voyageNo} placeholder="e.g. 202507" />
          </FieldRow>
          <FieldRow label="Report Type">
            <Select
              name="reportType"
              value={reportType}
              onChange={(e) => {
                const next = e.target.value as VoyageReportTypeValue;
                setReportType(next);
                // "While in Port" and Vessel Status = In Port always go
                // together in the real report — a vessel can't file a port
                // report while underway. Sync them here so Port Stay (hrs)
                // actually shows up instead of silently requiring the crew
                // to also flip Vessel Status by hand.
                if (next === "IN_PORT") setVesselStatus("IN_PORT");
                else if (vesselStatus === "IN_PORT") setVesselStatus("SAILING");
                // Noon Position is, by definition, taken at noon — default
                // Report Time to it instead of leaving the field blank and
                // waiting for the crew to type the one value that's already
                // known. A blank Report Time defaults to midnight in the
                // elapsed-time math elsewhere, which throws off Steaming
                // Time/Port Stay discrepancy checks for no real reason.
                if (next === "NOON_AT_SEA" && reportTimeLocal.trim() === "") setReportTimeLocal("1200H");
              }}
            >
              {VOYAGE_REPORT_TYPES.map((v) => (
                <option key={v} value={v}>
                  {VOYAGE_REPORT_TYPE_LABELS[v]}
                </option>
              ))}
            </Select>
          </FieldRow>
        </div>

        <div className="grid grid-cols-1 divide-y divide-border rounded-md border border-border @[820px]:grid-cols-3 @[820px]:divide-x @[820px]:divide-y-0">
          <FieldRow label="From Port">
            <Input name="fromPort" defaultValue={defaults.fromPort} />
          </FieldRow>
          <FieldRow label="Next Port">
            <Input name="nextPort" defaultValue={defaults.nextPort} />
          </FieldRow>
          <FieldRow label="Course">
            <Input name="course" defaultValue={defaults.course} />
          </FieldRow>
        </div>

        <div className="grid grid-cols-1 divide-y divide-border rounded-md border border-border md:grid-cols-2 md:divide-x md:divide-y-0">
          <FieldRow label="ZD (Zone Description)">
            <Input name="zoneDescription" defaultValue={defaults.zoneDescription} placeholder="e.g. -2" />
          </FieldRow>
          <FieldRow label="Report Time">
            <Input name="reportTimeLocal" value={reportTimeLocal} onChange={(e) => setReportTimeLocal(e.target.value)} placeholder="e.g. 0800H" required />
          </FieldRow>
        </div>

        {vesselStatus === "IN_PORT" && (
          <PairedRow
            left={
              <FieldRow label="Port Stay (hrs)">
                <input type="hidden" name="portStayHrs" value={portStayHrsLive != null ? portStayHrsLive.toFixed(2) : ""} />
                <div className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                  {portStayHrsLive != null ? portStayHrsLive.toFixed(2) : (defaults.portStayHrs || "—")}
                </div>
              </FieldRow>
            }
            right={
              <ReadOnlyRow
                label="Total Time in Port (hrs)"
                value={totalPortStayHrsLive != null ? totalPortStayHrsLive.toFixed(2) : defaults.totalPortStayHrs}
              />
            }
          />
        )}

        {/* The vessel is still alongside from the last While-in-Port report
            until it actually sails — that stretch needs its own Port Stay
            entry too, or the hours between the last daily report and the
            actual departure time silently vanish from the total. */}
        {isDeparture && (
          <PairedRow
            left={
              <FieldRow label="Port Stay Before Departure (hrs)">
                <input type="hidden" name="portStayHrs" value={portStayHrsLive != null ? portStayHrsLive.toFixed(2) : ""} />
                <div className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                  {portStayHrsLive != null ? portStayHrsLive.toFixed(2) : (defaults.portStayHrs || "—")}
                </div>
              </FieldRow>
            }
            right={
              <ReadOnlyRow
                label="Total Time in Port (Last Stay)"
                value={totalPortStayHrsLive != null ? totalPortStayHrsLive.toFixed(2) : defaults.totalPortStayHrs}
              />
            }
          />
        )}
      </Section>

      <Section title="Position" defaultOpen>
        <div className="rounded-md border border-border">
          <FieldRow label="Position / Location">
            <Input name="position" defaultValue={defaults.position} placeholder={`e.g. 33° 57.75' S 25° 38.67' E, or At Singapore anchorage`} />
          </FieldRow>
        </div>
      </Section>

      <Section title="Draft, Times & Status" defaultOpen>
        <div className="grid grid-cols-1 divide-y divide-border rounded-md border border-border @[820px]:grid-cols-3 @[820px]:divide-x @[820px]:divide-y-0">
          <FieldRow label="Draft Fwd">
            <UnitInput name="draftFwdM" value={draftFwdM} onChange={(e) => setDraftFwdM(e.target.value)} unit="m" />
          </FieldRow>
          <FieldRow label="Draft Aft">
            <UnitInput name="draftAftM" value={draftAftM} onChange={(e) => setDraftAftM(e.target.value)} unit="m" />
          </FieldRow>
          <FieldRow label="Draft Mean">
            <UnitInput name="draftMeanM" value={draftMeanM != null ? draftMeanM.toFixed(2) : ""} readOnly unit="m" />
          </FieldRow>
        </div>
        <div
          className={`grid grid-cols-1 divide-y divide-border rounded-md border border-border @[820px]:divide-x @[820px]:divide-y-0 ${
            vesselStatus === "IN_PORT" ? "@[820px]:grid-cols-2" : "@[820px]:grid-cols-3"
          }`}
        >
          <FieldRow label="Vessel Status">
            <Select name="vesselStatus" value={vesselStatus} onChange={(e) => setVesselStatus(e.target.value as VesselTrackerStatusValue)}>
              {VESSEL_TRACKER_STATUSES.map((v) => (
                <option key={v} value={v}>
                  {VESSEL_TRACKER_STATUS_LABELS[v]}
                </option>
              ))}
            </Select>
          </FieldRow>
          <FieldRow label="Vessel State">
            <Select name="ladenState" defaultValue={defaults.ladenState}>
              {LADEN_STATES.map((v) => (
                <option key={v} value={v}>
                  {LADEN_STATE_LABELS[v]}
                </option>
              ))}
            </Select>
          </FieldRow>
          {/* Engine's dead while in port — no order to log. */}
          {vesselStatus !== "IN_PORT" && (
            <FieldRow label="Engine Order">
              <Select name="engineOrder" defaultValue={defaults.engineOrder}>
                <option value="">— Not applicable —</option>
                {ENGINE_ORDERS.map((v) => (
                  <option key={v} value={v}>
                    {ENGINE_ORDER_LABELS[v]}
                  </option>
                ))}
              </Select>
            </FieldRow>
          )}
        </div>
      </Section>

      {!isPortOnly && (
        <Section title="Voyage / Performance">
          {isDeparture ? (
            // Departure — vessel hasn't sailed yet this period, so every
            // other figure below is genuinely not-yet-known. Distance To
            // Go is the only one worth asking for here.
            <div className="rounded-md border border-border text-sm">
              <FieldRow label="DTG (Next Port, nm)">
                <Input type="number" step="any" name="dtgNextPortNm" value={dtgNextPortNm} onChange={(e) => setDtgNextPortNm(e.target.value)} />
              </FieldRow>
            </div>
          ) : (
          /* Last 24 Hours vs Voyage To Date, same pairing as the printable
              report — one compact box, every row label+control on one
              line, gray boxes marking the system-calculated Voyage To Date
              values without needing an explanatory sentence under each. */
          <div className="overflow-hidden rounded-md border border-border text-sm">
            <div className="grid grid-cols-1 divide-y divide-border border-b border-border bg-muted/40 md:grid-cols-2 md:divide-x md:divide-y-0">
              <div className="px-3 py-1.5 text-center">
                <div className="text-xs font-bold uppercase tracking-wide">Last 24 Hours</div>
                <div className="text-[11px] text-muted-foreground">Current Reporting Period</div>
              </div>
              <div className="px-3 py-1.5 text-center">
                <div className="text-xs font-bold uppercase tracking-wide">Voyage To Date</div>
                <div className="text-[11px] text-muted-foreground">Since Voyage Commencement</div>
              </div>
            </div>
            <div className="divide-y divide-border">
              <PairedRow
                left={
                  <FieldRow label="Dist Run (nm)">
                    <Input type="number" step="any" name="distanceRunNm" value={distanceRunNm} onChange={(e) => setDistanceRunNm(e.target.value)} />
                  </FieldRow>
                }
                right={<ReadOnlyRow label="Total Dist Run (nm)" value={totalDistanceRunNmLive != null ? totalDistanceRunNmLive.toFixed(2) : defaults.totalDistanceRunNm} />}
              />
              <PairedRow
                left={
                  <FieldRow label="Steaming Time (hrs)">
                    <input type="hidden" name="steamingTimeHrs" value={effectiveSteamingTimeHrs != null ? effectiveSteamingTimeHrs.toFixed(2) : ""} />
                    <div className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                      {effectiveSteamingTimeHrs != null ? effectiveSteamingTimeHrs.toFixed(2) : "—"}
                    </div>
                  </FieldRow>
                }
                right={
                  <ReadOnlyRow
                    label="Total Steaming Time (hrs)"
                    value={totalSteamingTimeHrsLive != null ? totalSteamingTimeHrsLive.toFixed(2) : defaults.totalSteamingTimeHrs}
                  />
                }
              />
              <PairedRow
                left={
                  <FieldRow label="Observed Speed (kn)">
                    <input type="hidden" name="obsSpeedKn" value={obsSpeedKn != null ? obsSpeedKn.toFixed(2) : ""} />
                    <div className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                      {obsSpeedKn != null ? obsSpeedKn.toFixed(2) : "—"}
                    </div>
                  </FieldRow>
                }
                right={<ReadOnlyRow label="Voyage Avg Speed (kn)" value={generalAvgSpeedKnLive != null ? generalAvgSpeedKnLive.toFixed(2) : defaults.generalAvgSpeedKn} />}
              />
              <PairedRow
                left={
                  <FieldRow label="Engine Distance (nm)">
                    <Input type="number" step="any" name="engineDistanceNm" value={engineDistanceNm} onChange={(e) => setEngineDistanceNm(e.target.value)} />
                  </FieldRow>
                }
                right={
                  <ReadOnlyRow
                    label="Total Engine Distance (nm)"
                    value={totalEngineDistanceNmLive != null ? totalEngineDistanceNmLive.toFixed(2) : defaults.totalEngineDistanceNm}
                  />
                }
              />
              <PairedRow
                left={
                  <FieldRow label="RPM">
                    <Input type="number" step="any" name="rpm" defaultValue={defaults.rpm} />
                  </FieldRow>
                }
                right={
                  <ReadOnlyRow
                    label="Avg Engine Speed (kn)"
                    value={generalAvgEngineSpeedKnLive != null ? generalAvgEngineSpeedKnLive.toFixed(2) : defaults.generalAvgEngineSpeedKn}
                  />
                }
              />
              <PairedRow
                left={
                  <FieldRow label="Slip (%)">
                    <input type="hidden" name="slipPct" value={effectiveSlipPct != null ? effectiveSlipPct.toFixed(2) : ""} />
                    <div className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                      {effectiveSlipPct != null ? effectiveSlipPct.toFixed(2) : "—"}
                    </div>
                  </FieldRow>
                }
                right={<ReadOnlyRow label="Voyage Avg Slip (%)" value={generalAvgSlipPctLive != null ? generalAvgSlipPctLive.toFixed(2) : defaults.generalAvgSlipPct} />}
              />
              <PairedRow
                left={
                  <FieldRow label="Beaufort Scale">
                    <Input type="number" step="1" name="beaufortScale" defaultValue={defaults.beaufortScale} />
                  </FieldRow>
                }
                right={
                  <FieldRow label="Barometer">
                    <Input type="number" step="any" name="barometer" defaultValue={defaults.barometer} />
                  </FieldRow>
                }
              />
              <PairedRow
                left={
                  <FieldRow label="Weather Condition">
                    <Input name="weatherCondition" defaultValue={defaults.weatherCondition} />
                  </FieldRow>
                }
                right={
                  <FieldRow label="M/E Speed (kn)">
                    <Input type="number" step="any" name="meSpeedKn" defaultValue={defaults.meSpeedKn} />
                  </FieldRow>
                }
              />
              <PairedRow
                left={
                  <FieldRow label="DTG (Next Port, nm)">
                    <input type="hidden" name="dtgNextPortNm" value={effectiveDtgNextPortNm != null ? effectiveDtgNextPortNm.toFixed(2) : ""} />
                    <div className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                      {effectiveDtgNextPortNm != null ? effectiveDtgNextPortNm.toFixed(2) : "—"}
                    </div>
                  </FieldRow>
                }
                right={
                  <FieldRow label="Distance Log (nm)">
                    <Input type="number" step="any" name="distanceLogNm" defaultValue={defaults.distanceLogNm} />
                  </FieldRow>
                }
              />
              <PairedRow
                left={
                  <FieldRow label="Off-hire Duration (hrs)">
                    <Input type="number" step="any" name="offHireHrs" defaultValue={defaults.offHireHrs} />
                  </FieldRow>
                }
                right={
                  isNoon ? (
                    <FieldRow label="Exhaust Temp Unit">
                      <Input name="exhaustTempUnit" defaultValue={defaults.exhaustTempUnit} placeholder="e.g. °C" />
                    </FieldRow>
                  ) : (
                    <div />
                  )
                }
              />
              {isNoon && (
                <div className="px-3 py-1.5">
                  <FieldRow label="Exhaust Gas Temp">
                    <Input name="exhaustGasTemp" defaultValue={defaults.exhaustGasTemp} placeholder="per-cylinder readings" />
                  </FieldRow>
                </div>
              )}
            </div>
          </div>
          )}
        </Section>
      )}

      {!isPortOnly && (
        <Section title="ETA Next Port">
          {isDeparture ? (
            // DTG is already on hand at Departure — the crew supplies an
            // assumed/planned Speed (there's no real reading yet, the
            // vessel's only just left) purely so the ETA has a basis to be
            // estimated from; it computes itself from there.
            <div className="rounded-md border border-border text-sm">
              <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y-0">
                <FieldRow label="Speed (kn)">
                  <Input type="number" step="any" name="obsSpeedKn" value={etaSpeedKn} onChange={(e) => setEtaSpeedKn(e.target.value)} />
                </FieldRow>
                <FieldRow label="ZD (Zone Description)">
                  <Input name="etaNextPortZd" defaultValue={defaults.etaNextPortZd} placeholder="e.g. -2" />
                </FieldRow>
              </div>
              <div className="grid grid-cols-1 divide-y divide-border border-t border-border md:grid-cols-2 md:divide-x md:divide-y-0">
                <ReadOnlyRow label="ETA Date" value={computedEta?.date ?? ""} />
                <ReadOnlyRow label="ETA Time" value={computedEta?.time ?? ""} />
              </div>
              <input type="hidden" name="etaNextPortDate" value={computedEta?.date ?? defaults.etaNextPortDate} />
              <input type="hidden" name="etaNextPortTime" value={computedEta?.time ?? defaults.etaNextPortTime} />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Date</Label>
                <Input type="date" name="etaNextPortDate" defaultValue={defaults.etaNextPortDate} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Time</Label>
                <Input name="etaNextPortTime" defaultValue={defaults.etaNextPortTime} placeholder="e.g. 0800H" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">ZD (Zone Description)</Label>
                <Input name="etaNextPortZd" defaultValue={defaults.etaNextPortZd} placeholder="e.g. -2" />
              </div>
            </div>
          )}
        </Section>
      )}

      {isPortOnly && (
        // vesselStatus:IN_PORT already computes Port Stay above; while in
        // port the vessel doesn't burn off-hire the same way a sea passage
        // does, but the field still needs to reach the server if used.
        <input type="hidden" name="offHireHrs" value={defaults.offHireHrs} />
      )}

      <Section title="Fuel / Lube / Fresh Water" defaultOpen>
        <BunkerLedgerTable bunkerDefaults={defaults.bunker} previousRob={previousRob} avgConsumed={avgConsumed} robHistory={robHistory} isEdit={isEdit} />
      </Section>

      <Section title="Cargo" defaultOpen={isDeparture}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">
              Type of Cargo Onboard {isDeparture && <span className="text-danger">*</span>}
            </Label>
            <Input name="cargoOnboard" value={cargoOnboard} onChange={(e) => setCargoOnboard(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Cargo to Disc / Loaded</Label>
            <Input name="cargoToDiscLoaded" defaultValue={defaults.cargoToDiscLoaded} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">BL Quantity</Label>
            <Input type="number" step="any" name="blQuantity" defaultValue={defaults.blQuantity} />
          </div>
        </div>
      </Section>

      <Section title="Tank Temperature">
        <div className="space-y-1.5">
          <Label className="text-xs">Cargo Temp (B-M-T)</Label>
          <AutoGrowInput name="cargoTemp" defaultValue={defaults.cargoTemp} className="max-h-none" placeholder="e.g. TK1 - 14.8, 14.0, 0.0 / TK2 - 17.1, 16.2, 18.5" />
        </div>
      </Section>

      <Section title="Agent">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input name="agentName" defaultValue={defaults.agentName} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tel</Label>
            <Input name="agentTel" defaultValue={defaults.agentTel} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Fax</Label>
            <Input name="agentFax" defaultValue={defaults.agentFax} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Email</Label>
            <Input type="email" name="agentEmail" defaultValue={defaults.agentEmail} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Address</Label>
          <Input name="agentAddress" defaultValue={defaults.agentAddress} />
        </div>
      </Section>

      <Section title="Daily Working Report">
        <div className="space-y-1.5">
          <Label className="text-xs">Deck Dept.</Label>
          <AutoGrowInput name="deckDeptReport" defaultValue={defaults.deckDeptReport} className="max-h-none" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Engine Dept.</Label>
          <AutoGrowInput name="engineDeptReport" defaultValue={defaults.engineDeptReport} className="max-h-none" />
        </div>
      </Section>

      <Section title="Statement of Facts" defaultOpen={isDeparture}>
        <div className="space-y-1.5">
          <Label className="text-xs">
            Timestamped event log for this report {isDeparture && <span className="text-danger">*</span>}
          </Label>
          <AutoGrowInput name="statementOfFacts" value={statementOfFacts} onChange={(e) => setStatementOfFacts(e.target.value)} className="max-h-none" rows={6} />
        </div>
      </Section>

      <Section title="Remarks">
        <AutoGrowInput name="remarks" defaultValue={defaults.remarks} className="max-h-none" />
      </Section>

      <Section title="Master / Chief Engineer">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Master</Label>
            <Input name="master" defaultValue={defaults.master} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Chief Engineer</Label>
            <Input name="chiefEngineer" defaultValue={defaults.chiefEngineer} />
          </div>
        </div>
      </Section>

      {state.error && (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <SubmitButton label={isEdit ? "Save changes" : "Add entry"} />
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>

      {showDepartureAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowDepartureAlert(false)}>
          <div className="w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning/10 text-warning">
                <AlertTriangle className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold">Departure report is incomplete</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Please fill in {missingDepartureFields.join(" and ")} before saving — a Departure report needs to record what's onboard and
                  what happened in port before the vessel sails.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <Button type="button" variant="accent" size="sm" onClick={() => setShowDepartureAlert(false)}>
                OK, I&apos;ll fill it in
              </Button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
