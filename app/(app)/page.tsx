import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  SearchCheck,
  ShieldCheck,
  Activity,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getViewAsDisplay } from "@/lib/view-as";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  VerticalBarChart,
  VerticalGroupedBarChart,
  paletteColor,
  type BarDatum,
  type StackedDatum,
  type LegendEntry,
} from "@/components/ui/bar-chart";
import { sireAnalytics, resolveSirePeriod, getSireKpiTargets, listSireSchedule, sireScheduleAlerts } from "@/features/sire/queries";
import { VIQ_CHAPTERS } from "@/features/sire/schema";
import { listInternalAuditSchedule, internalAuditScheduleAlerts } from "@/features/internal-audits/queries";
import { pscAnalytics } from "@/features/psc/queries";
import { cdiAnalytics } from "@/features/cdi/queries";
import { companyInspectionAnalytics } from "@/features/company-inspections/queries";
import { flagInspectionAnalytics } from "@/features/flag-inspections/queries";
import { getIncidentKpis } from "@/features/incidents/queries";
import { getRollingKpiDashboard, getExposureKpiTargets } from "@/features/exposure-hours/queries";
import { getFleetCapaClosureRate } from "@/features/capa/queries";
import { getNearMissReportingCounts } from "@/features/near-miss/queries";
import { GaugeChart } from "@/components/ui/gauge-chart";
import { startOfToday } from "@/lib/kpi-period";
import { formatDate } from "@/lib/utils";
import { getFleetVesselHealth, listVesselOptions as listVesselHealthOptions } from "@/features/vessel-health/queries";
import { Ship, FileWarning, ClipboardList, Users2, PackageSearch, NotebookPen } from "lucide-react";
import { ScheduleAlertsPanel } from "./schedule-alerts-panel";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  // Every KPI/analytics query below takes this — undefined (fleet-wide) for
  // office, the session's own vessel for shipboard (real Ship Officer
  // logins, or an Administrator's "view as Vessel" toggle — see
  // lib/view-as.ts). A shipboard session should only ever see its own
  // ship's numbers here, never the fleet's.
  const isShipboard = user.department === "SHIPBOARD";
  const kpiVesselId = isShipboard ? (user.vesselId ?? undefined) : undefined;

  // Same Year+Quarter selector as the SIRE/PSC/CDI/Company Inspection KPI
  // pages — cumulative YTD quarters (Q3 = Jan–Sep), not isolated ones. No
  // year selected = All Time.
  const year = sp.year ? Number(sp.year) : undefined;
  const quarter = sp.quarter ? Number(sp.quarter) : undefined;
  const comparisonRange = resolveSirePeriod(year, quarter);

  // TMSA "Missed Observation" comparison: SIRE / PSC / Flag State are
  // external inspections; Company Inspection is internal. If the company's
  // own average observations per inspection is lower than what external
  // bodies find, that gap is evidence the internal process is missing
  // things the external inspectors catch — gated on every module's own read
  // permission (not a department check). Data itself is scoped by
  // kpiVesselId below, same as the rest of the Dashboard.
  const canSeeInspectionComparison =
    can(user, "sire:read") &&
    can(user, "psc:read") &&
    can(user, "cdi:read") &&
    can(user, "flaginsp:read") &&
    can(user, "cinsp:read");
  // pscAnalytics requires a concrete range (unlike sire/cdi/flag/company
  // inspection's optional one) — fall back to epoch-to-today when the
  // selector resolved to "all time" (both ends undefined).
  const pscRange = {
    from: comparisonRange.from ?? new Date(0),
    to: comparisonRange.to ?? startOfToday(),
  };
  const [sireKpi, pscKpi, cdiKpi, flagKpi, cinspKpi] = canSeeInspectionComparison
    ? await Promise.all([
        sireAnalytics(user.companyId, comparisonRange, kpiVesselId),
        pscAnalytics(user.companyId, pscRange, kpiVesselId),
        cdiAnalytics(user.companyId, comparisonRange, kpiVesselId),
        flagInspectionAnalytics(user.companyId, comparisonRange, kpiVesselId),
        companyInspectionAnalytics(user.companyId, comparisonRange, kpiVesselId),
      ])
    : [null, null, null, null, null];

  const canSeeSireSchedule = can(user, "sire:read");
  const [sireObsStat, sireObsTargets] = canSeeSireSchedule
    ? await Promise.all([sireAnalytics(user.companyId, {}, kpiVesselId), getSireKpiTargets(user.companyId)])
    : [null, null];

  // One-vessel operational checklist — pulls from every module that tracks
  // its own per-vessel open items (including SIRE/Internal Audit due-dates,
  // Committee Meeting and Drill monthly compliance — the fleet-wide "N
  // vessels due" alert cards these used to power were folded in here
  // instead, so requires read access to all of them, same all-or-nothing
  // gating convention as canSeeInspectionComparison).
  const canSeeVesselHealth =
    can(user, "incident:read") &&
    can(user, "nm:read") &&
    can(user, "drill:read") &&
    can(user, "vesseldoc:read") &&
    can(user, "meeting:read") &&
    can(user, "procurement:read") &&
    can(user, "vtracker:read") &&
    can(user, "sire:read") &&
    can(user, "iaudit:read");
  const healthVesselId = sp.healthVesselId || undefined;
  const [vesselHealthOptions, fleetHealth] = canSeeVesselHealth
    ? await Promise.all([listVesselHealthOptions(user.companyId), getFleetVesselHealth(user.companyId)])
    : [[], []];
  // The fleet batch already computed every vessel's report — no need for a
  // second, largely-duplicate query pass just to pick out the selected one.
  const vesselHealth = healthVesselId ? (fleetHealth.find((v) => v.vesselId === healthVesselId) ?? null) : null;

  // SIRE/Internal Audit "due this month" is a scheduling/compliance signal,
  // not a pending-action-item like the rest of Vessel Health — kept as its
  // own alert card instead of mixed into that per-vessel checklist. Gated
  // (and fetched) independently of canSeeVesselHealth's all-or-nothing
  // permission set, so a user with just sire:read/iaudit:read still sees
  // it even without every other Vessel Health permission — the fetch
  // itself is cheap (2 lightweight queries each, scoped by kpiVesselId same
  // as everything else here), so the small duplication against
  // getFleetVesselHealth's own copy of this data isn't worth the RBAC
  // correctness it would cost to dedupe.
  const sireAlerts = canSeeSireSchedule ? sireScheduleAlerts(await listSireSchedule(user.companyId, kpiVesselId)) : [];
  const canSeeInternalAuditSchedule = can(user, "iaudit:read");
  const iAuditAlerts = canSeeInternalAuditSchedule
    ? internalAuditScheduleAlerts(await listInternalAuditSchedule(user.companyId, kpiVesselId))
    : [];

  const healthItems = vesselHealth
    ? [
        // SIRE/Internal Audit due-status is deliberately NOT shown here —
        // Vessel Health is scoped to actionable pending items (CAPA,
        // investigations, requisitions, etc.) that the Supt needs to close
        // out, whereas an overdue SIRE/Internal Audit is a scheduling/
        // compliance state, a different kind of thing. It has its own
        // "due this month" alert card further down the Dashboard instead.
        // One tile per module (fixed set, always shown even at 0). Labeled
        // as pending OBSERVATIONS, deliberately not "CAPA" — a single
        // observation/finding commonly carries two or three CAPA actions at
        // once, so counting CAPA rows would overstate how many things are
        // actually outstanding. This counts distinct pending items instead.
        ...vesselHealth.capaPendingByModule.map((m) => ({
          icon: ClipboardList,
          label: `${m.module} — Pending Observations`,
          detail: `${m.count} pending observation${m.count === 1 ? "" : "s"}`,
          bad: m.count > 0,
          href: undefined,
        })),
        {
          icon: AlertTriangle,
          label: "Incident Investigations",
          detail: `${vesselHealth.incidentsPendingInvestigation} pending investigation${vesselHealth.incidentsPendingInvestigation === 1 ? "" : "s"}`,
          bad: vesselHealth.incidentsPendingInvestigation > 0,
          href: undefined,
        },
        {
          icon: Activity,
          label: "Near Miss",
          detail: `${vesselHealth.nearMissOpen} open, awaiting office action`,
          bad: vesselHealth.nearMissOpen > 0,
          href: undefined,
        },
        {
          icon: ShieldCheck,
          label: "Drills",
          detail: `${vesselHealth.drillsOverdue} overdue of ${vesselHealth.drillsTotal} tracked`,
          bad: vesselHealth.drillsOverdue > 0,
          href: undefined,
        },
        {
          icon: ShieldCheck,
          label: "Drill (This Month)",
          detail:
            vesselHealth.drillsMissingThisMonth.length > 0
              ? `Not yet done: ${vesselHealth.drillsMissingThisMonth.slice(0, 2).join(", ")}${vesselHealth.drillsMissingThisMonth.length > 2 ? ` +${vesselHealth.drillsMissingThisMonth.length - 2} more` : ""}`
              : "This month's required drill(s) done",
          bad: vesselHealth.drillsMissingThisMonth.length > 0,
          href: undefined,
        },
        {
          icon: FileWarning,
          label: "Documents / Certificates",
          detail: `${vesselHealth.documentsExpired} expired, ${vesselHealth.documentsExpiringSoon} expiring soon`,
          bad: vesselHealth.documentsExpired > 0 || vesselHealth.documentsExpiringSoon > 0,
          href: undefined,
        },
        {
          icon: Users2,
          label: "Committee Meetings",
          detail: `${vesselHealth.meetingsPendingOfficeReply} awaiting office reply`,
          bad: vesselHealth.meetingsPendingOfficeReply > 0,
          href: undefined,
        },
        {
          icon: Users2,
          label: "Committee Meeting (This Month)",
          detail: vesselHealth.meetingHeldThisMonth ? "This month's required meeting held" : "No meeting held yet this month",
          bad: !vesselHealth.meetingHeldThisMonth,
          href: undefined,
        },
        {
          icon: PackageSearch,
          label: "Requisitions",
          detail: `${vesselHealth.requisitionsPendingDelivery} pending delivery`,
          bad: vesselHealth.requisitionsPendingDelivery > 0,
          href: undefined,
        },
        {
          icon: NotebookPen,
          label: "Daily Report",
          detail: vesselHealth.lastDailyReportDate
            ? `Last submitted ${formatDate(vesselHealth.lastDailyReportDate)} (${vesselHealth.daysSinceLastDailyReport}d ago)`
            : "No daily report on record",
          bad: vesselHealth.daysSinceLastDailyReport === null || vesselHealth.daysSinceLastDailyReport > 2,
          href: undefined,
        },
      ]
    : [];

  // Safety Performance tiles — gated on holding read access to every module
  // feeding them (a permission check, not a department check). The data
  // itself is scoped by kpiVesselId above: fleet-wide for office, one
  // vessel's own numbers for a shipboard session.
  const canSeeSafetyPerformance = can(user, "incident:read") && can(user, "exposure:read") && can(user, "nm:read");
  const [incidentKpis, exposureKpi, exposureTargets, capaRate, nearMissCounts] = canSeeSafetyPerformance
    ? await Promise.all([
        getIncidentKpis(user.companyId, undefined, kpiVesselId),
        getRollingKpiDashboard(user.companyId, { vesselId: kpiVesselId }),
        getExposureKpiTargets(user.companyId),
        getFleetCapaClosureRate(user.companyId, kpiVesselId),
        getNearMissReportingCounts(user.companyId, undefined, kpiVesselId),
      ])
    : [null, null, null, null, null];

  // While previewing as a vessel, the greeting should read like that
  // vessel's own login (matching a real Ship Officer session) rather than
  // the underlying Administrator's own name/role.
  const { active: previewingAsVessel, vesselName: previewVesselName } = user.roles.includes("Administrator")
    ? await getViewAsDisplay(user.companyId)
    : { active: false, vesselName: null };

  // Shipboard accounts are named after the vessel itself (e.g. "Swan
  // Aquarius"), not a person — truncating to the first word would read as a
  // cut-off name ("Welcome, Swan"), so show the full name for those.
  const firstName =
    previewingAsVessel && previewVesselName
      ? previewVesselName
      : user.department === "SHIPBOARD"
        ? user.fullName
        : user.fullName.split(" ")[0];
  const dept = user.department
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
  const roleLabel = previewingAsVessel ? "Ship Officer" : user.roles.join(", ") || "No role assigned";

  const comparisonRows = canSeeInspectionComparison
    ? [
        { label: "SIRE", ...sireKpi! },
        { label: "PSC", ...pscKpi! },
        { label: "CDI", ...cdiKpi! },
        { label: "Flag Inspection", ...flagKpi! },
        { label: "Company Inspection", ...cinspKpi! },
      ]
    : [];
  // Company Inspection gets a visually distinct color (violet) from the
  // external bodies (which cycle through the palette starting at 0) so the
  // internal-vs-external contrast the chart is making reads at a glance,
  // not just from the label.
  const comparisonData: BarDatum[] = comparisonRows.map((r, i) => ({
    label: r.label,
    value: Number(r.avgPerInspection.toFixed(2)),
    color: r.label === "Company Inspection" ? paletteColor(5) : paletteColor(i),
  }));
  // Only compare against external bodies that actually have inspections on
  // record — an unused module reading 0 would otherwise look like a
  // (misleadingly good) baseline instead of just "no data yet".
  const externalWithData = comparisonRows.filter((r) => r.label !== "Company Inspection" && r.totalInspections > 0);
  const externalMax = externalWithData.length
    ? Math.max(...externalWithData.map((r) => r.avgPerInspection))
    : null;
  const cinspRow = comparisonRows.find((r) => r.label === "Company Inspection");
  const missedObservationGap =
    externalMax !== null && cinspRow && cinspRow.totalInspections > 0 ? externalMax - cinspRow.avgPerInspection : null;

  // SIRE and Company Inspection both use the same VIQ chapter taxonomy —
  // comparing them per chapter (not just the single overall average above)
  // shows WHERE the internal process is missing things, not just that it
  // is. Reuses the same sireKpi/cinspKpi already fetched for the chart
  // above, so no extra query.
  const chapterComparisonData: StackedDatum[] = canSeeInspectionComparison
    ? VIQ_CHAPTERS.map((c) => ({
        label: `${c.no}-${c.title.split(" ")[0]}`,
        segments: [
          { key: "SIRE", value: sireKpi!.byChapter[c.no] ?? 0, color: paletteColor(0) },
          { key: "Company Inspection", value: cinspKpi!.byChapter[c.no] ?? 0, color: paletteColor(1) },
        ],
      }))
    : [];
  const chapterComparisonLegend: LegendEntry[] = [
    { key: "SIRE", color: paletteColor(0) },
    { key: "Company Inspection", color: paletteColor(1) },
  ];

  // Plain-language read of the LTIF/TRCF gauges — a colored needle alone
  // still makes the reader do the "is this good or bad" math themselves;
  // this states it outright, same spirit as the Missed Observation gap
  // sentence below the Inspection Effectiveness chart.
  const safetyTargetMisses =
    canSeeSafetyPerformance && exposureKpi && exposureTargets
      ? [
          exposureKpi.totals.ltif > exposureTargets.ltifTarget
            ? `LTIF is ${exposureKpi.totals.ltif.toFixed(2)} against a target of ≤ ${exposureTargets.ltifTarget.toFixed(2)} — you are over target.`
            : null,
          exposureKpi.totals.trcf > exposureTargets.trcfTarget
            ? `TRCF is ${exposureKpi.totals.trcf.toFixed(2)} against a target of ≤ ${exposureTargets.trcfTarget.toFixed(2)} — you are over target.`
            : null,
        ].filter((m): m is string => m !== null)
      : [];

  // Header-level "at a glance" count — every Safety Performance gauge
  // currently reading over its own target. Kept to the gauges specifically
  // (not drills/meetings/etc.) so it stays a precise, single-meaning number
  // rather than a mixed bag of unrelated alert types.
  const kpiViolationCount =
    [
      canSeeSafetyPerformance && exposureKpi && exposureTargets ? exposureKpi.totals.ltif > exposureTargets.ltifTarget : false,
      canSeeSafetyPerformance && exposureKpi && exposureTargets ? exposureKpi.totals.trcf > exposureTargets.trcfTarget : false,
      sireObsStat && sireObsTargets ? sireObsStat.avgPerInspection > sireObsTargets.avgObservationTarget : false,
    ].filter(Boolean).length;

  return (
    <>
      <PageHeader
        title={`Welcome, ${firstName}`}
        description={`${dept} Department · ${roleLabel}`}
        actions={
          kpiViolationCount > 0 ? (
            <Badge tone="danger" className="px-3 py-1 text-sm">
              {kpiViolationCount} KPI Violation{kpiViolationCount === 1 ? "" : "s"} Active
            </Badge>
          ) : undefined
        }
      />

      {canSeeSafetyPerformance && incidentKpis && exposureKpi && exposureTargets && capaRate && nearMissCounts && (
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-accent" /> Safety Performance
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
            <Link href={can(user, "exposure:read") ? "/exposure-hours/kpi" : "#"}>
              <Card
                className={`h-full transition-colors hover:border-accent/40 ${exposureKpi.totals.ltif > exposureTargets.ltifTarget ? "border-danger/30 bg-danger/5" : ""}`}
              >
                <CardContent className="flex flex-col items-center pt-3">
                  <GaugeChart value={exposureKpi.totals.ltif} target={exposureTargets.ltifTarget} label="LTIF (Rolling 12mo)" size={110} />
                  <Badge tone={exposureKpi.totals.ltif <= exposureTargets.ltifTarget ? "success" : "danger"} className="mt-1">
                    {exposureKpi.totals.ltif <= exposureTargets.ltifTarget ? "Compliant" : "Over Target"}
                  </Badge>
                  <div className="mt-1 text-xs text-muted-foreground">Target ≤ {exposureTargets.ltifTarget.toFixed(2)}</div>
                </CardContent>
              </Card>
            </Link>
            <Link href={can(user, "exposure:read") ? "/exposure-hours/kpi" : "#"}>
              <Card
                className={`h-full transition-colors hover:border-accent/40 ${exposureKpi.totals.trcf > exposureTargets.trcfTarget ? "border-danger/30 bg-danger/5" : ""}`}
              >
                <CardContent className="flex flex-col items-center pt-3">
                  <GaugeChart value={exposureKpi.totals.trcf} target={exposureTargets.trcfTarget} label="TRCF (Rolling 12mo)" size={110} />
                  <Badge tone={exposureKpi.totals.trcf <= exposureTargets.trcfTarget ? "success" : "danger"} className="mt-1">
                    {exposureKpi.totals.trcf <= exposureTargets.trcfTarget ? "Compliant" : "Over Target"}
                  </Badge>
                  <div className="mt-1 text-xs text-muted-foreground">Target ≤ {exposureTargets.trcfTarget.toFixed(2)}</div>
                </CardContent>
              </Card>
            </Link>
            {sireObsStat && sireObsTargets && (
              <Link href="/sire/kpi">
                <Card
                  className={`h-full transition-colors hover:border-accent/40 ${sireObsStat.avgPerInspection > sireObsTargets.avgObservationTarget ? "border-danger/30 bg-danger/5" : ""}`}
                >
                  <CardContent className="flex flex-col items-center pt-3">
                    <GaugeChart
                      value={sireObsStat.avgPerInspection}
                      target={sireObsTargets.avgObservationTarget}
                      label="SIRE Avg Observations"
                      size={110}
                    />
                    <Badge
                      tone={sireObsStat.avgPerInspection <= sireObsTargets.avgObservationTarget ? "success" : "danger"}
                      className="mt-1"
                    >
                      {sireObsStat.avgPerInspection <= sireObsTargets.avgObservationTarget ? "Compliant" : "Over Target"}
                    </Badge>
                    <div className="mt-1 text-xs text-muted-foreground">Target ≤ {sireObsTargets.avgObservationTarget.toFixed(2)}</div>
                  </CardContent>
                </Card>
              </Link>
            )}
            <Link href={can(user, "incident:read") ? "/incidents" : "#"}>
              <Card
                className={`h-full transition-colors hover:border-accent/40 ${incidentKpis.openBySeverity.critical > 0 || incidentKpis.openBySeverity.high > 0 ? "border-danger/30 bg-danger/5" : ""}`}
              >
                <CardContent className="pt-4">
                  <div className="text-2xl font-semibold tabular-nums">{incidentKpis.openCount}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">Open Incidents</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {[
                      incidentKpis.openBySeverity.critical > 0 && `${incidentKpis.openBySeverity.critical} Critical`,
                      incidentKpis.openBySeverity.high > 0 && `${incidentKpis.openBySeverity.high} High`,
                      incidentKpis.openBySeverity.medium > 0 && `${incidentKpis.openBySeverity.medium} Medium`,
                      incidentKpis.openBySeverity.low > 0 && `${incidentKpis.openBySeverity.low} Low`,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "No open incidents"}
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Card className={incidentKpis.overdueCount > 0 ? "border-danger/30 bg-danger/5" : ""}>
              <CardContent className="pt-4">
                <div className={`text-2xl font-semibold tabular-nums ${incidentKpis.overdueCount > 0 ? "text-danger" : ""}`}>
                  {incidentKpis.overdueCount}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">Overdue Investigations (&gt;30d)</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-semibold tabular-nums">{capaRate.rate !== null ? `${capaRate.rate}%` : "—"}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">CAPA Closure Rate{isShipboard ? "" : " (Fleet-wide)"}</div>
                {capaRate.total > 0 && (
                  <div className="mt-1 text-xs text-muted-foreground">{capaRate.closed} of {capaRate.total} closed</div>
                )}
              </CardContent>
            </Card>
            <Link href={can(user, "nm:read") ? "/near-miss" : "#"}>
              <Card className="h-full transition-colors hover:border-accent/40">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-1.5">
                    <Activity className="h-4 w-4 text-accent" />
                    <div className="text-2xl font-semibold tabular-nums">{nearMissCounts.last30}</div>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">Near Miss Reports (Last 30 Days)</div>
                  <div className={`mt-1 text-xs ${nearMissCounts.last30 >= nearMissCounts.previous30 ? "text-success" : "text-muted-foreground"}`}>
                    vs {nearMissCounts.previous30} prior 30 days — more reporting is healthier
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          {safetyTargetMisses.length > 0 ? (
            <div className="mt-3 space-y-2">
              {safetyTargetMisses.map((message) => (
                <div key={message} className="flex items-start gap-2 rounded-md bg-danger/10 p-3 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                  <span>{message}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 flex items-start gap-2 rounded-md bg-success/10 p-3 text-sm">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <span>LTIF and TRCF are both within target — no action needed right now.</span>
            </div>
          )}
        </div>
      )}

      {canSeeVesselHealth && (
        <div className="mt-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Ship className="h-4 w-4 text-accent" /> Vessel Health
          </div>

          {fleetHealth.length > 0 && (
            <Card className="mb-4">
              <CardContent className="pt-5">
                <div className="mb-3 text-xs text-muted-foreground">
                  Click a vessel to see its full breakdown below. Numbers are how many items need attention.
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th rowSpan={2} className="px-3 py-2 align-bottom font-medium">Vessel</th>
                        <th colSpan={5} className="border-b border-danger/20 bg-danger/5 px-2 py-1 text-center font-medium text-danger">
                          Audits & Deficiencies
                        </th>
                        <th colSpan={2} className="border-b border-accent/20 bg-accent/5 px-2 py-1 text-center font-medium text-accent">
                          Safety
                        </th>
                        <th colSpan={4} className="border-b border-warning/20 bg-warning/5 px-2 py-1 text-center font-medium text-warning">
                          Admin & Certs
                        </th>
                        <th rowSpan={2} className="px-2 py-2 align-bottom text-center font-medium">RPT</th>
                      </tr>
                      <tr className="bg-muted/40">
                        <th className="px-2 py-2 text-center font-medium" title="Company Inspection — pending observations">CI</th>
                        <th className="px-2 py-2 text-center font-medium" title="PSC — pending observations">PSC</th>
                        <th className="px-2 py-2 text-center font-medium" title="External Audit — pending observations">EA</th>
                        <th className="px-2 py-2 text-center font-medium" title="Internal Audit Finding — pending observations">IAF</th>
                        <th className="px-2 py-2 text-center font-medium" title="NCR — pending observations">NCR</th>
                        <th className="px-2 py-2 text-center font-medium">INC</th>
                        <th className="px-2 py-2 text-center font-medium">NM</th>
                        <th className="px-2 py-2 text-center font-medium">DRL</th>
                        <th className="px-2 py-2 text-center font-medium">DOC</th>
                        <th className="px-2 py-2 text-center font-medium">MTG</th>
                        <th className="px-2 py-2 text-center font-medium">REQ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fleetHealth.map((v) => {
                        const docCount = v.documentsExpired + v.documentsExpiringSoon;

                        // "--" for a clean, non-issue cell instead of leaving it blank —
                        // easier to scan than guessing whether an empty cell means
                        // "zero" or "not loaded". Every column here is something the
                        // office needs to act on, so a nonzero count is always red;
                        // only the dash placeholder is muted.
                        const cell = (n: number) => (n > 0 ? { display: String(n), empty: false } : { display: "--", empty: true });
                        const cells: { display: string; empty: boolean }[] = [
                          // capaPendingByModule is fixed-order: Company Inspection, PSC,
                          // External Audit, Internal Audit, NCR, Incident, Near Miss —
                          // only the first 5 get their own column here; Incident/Near
                          // Miss CAPA folds into the existing INC/NM columns below.
                          ...v.capaPendingByModule.slice(0, 5).map((m) => cell(m.count)),
                          cell(v.incidentsPendingInvestigation),
                          cell(v.nearMissOpen),
                          cell(v.drillsOverdue),
                          cell(docCount),
                          // Meetings pending office reply is a real count of
                          // items; "not held yet this month" isn't a count of
                          // anything, so it gets the same "NEW" text flag as
                          // SIRE/IA/daily-report — not folded into the number.
                          v.meetingsPendingOfficeReply > 0
                            ? cell(v.meetingsPendingOfficeReply)
                            : v.meetingHeldThisMonth
                              ? { display: "--", empty: true }
                              : { display: "NEW", empty: false },
                          cell(v.requisitionsPendingDelivery),
                          v.daysSinceLastDailyReport === null
                            ? { display: "NEW", empty: false }
                            : cell(v.daysSinceLastDailyReport > 2 ? v.daysSinceLastDailyReport : 0),
                        ];
                        return (
                          <tr key={v.vesselId} className="border-b border-border last:border-0 hover:bg-muted/30">
                            <td className="px-3 py-2">
                              <Link href={`/?healthVesselId=${v.vesselId}#vessel-detail`} className="font-medium text-accent hover:underline">
                                {v.vesselName}
                              </Link>
                            </td>
                            {cells.map((c, i) => (
                              <td
                                key={i}
                                className={`px-2 py-2 text-center tabular-nums font-medium ${c.empty ? "text-muted-foreground" : "text-danger"}`}
                              >
                                {c.display}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          <Card id="vessel-detail">
            <CardContent className="pt-5">
              <form className="flex flex-wrap items-end gap-2">
                <Select key={healthVesselId ?? "none"} name="healthVesselId" defaultValue={healthVesselId ?? ""} className="w-56">
                  <option value="">Select a vessel…</option>
                  {vesselHealthOptions.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </Select>
                <Button type="submit" variant="outline">Check</Button>
              </form>

              {vesselHealth ? (
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {healthItems.map((item) => {
                    const Icon = item.icon;
                    const tile = (
                      <div
                        className={`flex items-start gap-2.5 rounded-md border p-3 text-sm ${item.bad ? "border-danger/30 bg-danger/5" : "border-border bg-muted/20"} ${item.href ? "h-full transition-colors hover:border-accent/40" : ""}`}
                      >
                        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${item.bad ? "text-danger" : "text-success"}`} />
                        <div>
                          <div className="font-medium">{item.label}</div>
                          <div className="text-xs text-muted-foreground">{item.detail}</div>
                        </div>
                      </div>
                    );
                    return item.href ? (
                      <Link key={item.label} href={item.href}>
                        {tile}
                      </Link>
                    ) : (
                      <div key={item.label}>{tile}</div>
                    );
                  })}
                </div>
              ) : healthVesselId ? (
                <p className="mt-4 text-sm text-muted-foreground">Vessel not found.</p>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  Pick a vessel to see its open items across every module at a glance.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <ScheduleAlertsPanel
        sireAlerts={canSeeSireSchedule ? sireAlerts : []}
        iAuditAlerts={canSeeInternalAuditSchedule ? iAuditAlerts : []}
      />

      <div className="mt-6">
      {canSeeInspectionComparison && (
        <Card>
          <CardContent className="pt-5">
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
              <SearchCheck className="h-4 w-4 text-accent" /> Inspection Effectiveness — Average Observations
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              SIRE, PSC, CDI and Flag Inspection are external; Company Inspection is the vessel&apos;s own. TMSA calls
              it a <span className="font-medium text-foreground">Missed Observation</span> when an external
              inspection finds more, on average, than the company&apos;s own inspections do — a sign the internal
              process isn&apos;t catching what it should.
            </p>

            <form className="mb-4 flex flex-wrap items-end gap-2">
              <Select name="year" defaultValue={year ? String(year) : ""} className="w-32">
                <option value="">All Time</option>
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </Select>
              <Select name="quarter" defaultValue={quarter ? String(quarter) : ""} className="w-36">
                <option value="">Full Year</option>
                <option value="1">Q1 (Jan–Mar)</option>
                <option value="2">Q2 (Jan–Jun)</option>
                <option value="3">Q3 (Jan–Sep)</option>
                <option value="4">Q4 (Jan–Dec)</option>
              </Select>
              <Button type="submit" variant="outline">Apply</Button>
            </form>

            <VerticalBarChart data={comparisonData} />
            {missedObservationGap !== null && (
              <div
                className={`mt-4 flex items-start gap-2 rounded-md p-3 text-sm ${
                  missedObservationGap > 0 ? "bg-danger/10" : "bg-success/10"
                }`}
              >
                <SearchCheck className={`mt-0.5 h-4 w-4 shrink-0 ${missedObservationGap > 0 ? "text-danger" : "text-success"}`} />
                <span>
                  {missedObservationGap > 0 ? (
                    <>
                      Company Inspection is averaging <span className="font-semibold">{missedObservationGap.toFixed(2)}</span> fewer
                      observations per inspection than the highest external body — a Missed Observation gap worth
                      investigating.
                    </>
                  ) : (
                    <>Company Inspection is averaging at or above every external body — no Missed Observation gap right now.</>
                  )}
                </span>
              </div>
            )}

            <div className="mt-6 border-t border-border pt-5">
              <div className="mb-3 text-sm font-semibold">By Chapter — SIRE vs Company Inspection</div>
              <VerticalGroupedBarChart data={chapterComparisonData} legend={chapterComparisonLegend} />
            </div>
          </CardContent>
        </Card>
      )}
      </div>

      <Card className="mt-6">
        <CardContent className="flex flex-col items-start gap-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">Ship Management System (SMS) Manual</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              The governing document set. Every controlled procedure, versioned
              and approval-tracked — the foundation the whole platform enforces.
            </p>
          </div>
          <Link
            href="/sms-manual"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Open SMS Manual <ArrowRight className="h-4 w-4" />
          </Link>
        </CardContent>
      </Card>
    </>
  );
}
