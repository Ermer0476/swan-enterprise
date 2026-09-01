"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { getVoyageCumulativeTotals, getLastArrival, getPreviousEntry, getPreviousSailingReport } from "./queries";
import {
  addVoyageLogSchema,
  updateVoyageLogSchema,
  deleteVoyageLogSchema,
  BUNKER_GRADES,
  BUNKER_GRADE_LABELS,
  bunkerFieldName,
  reportDateTimeMs,
  type BunkerGradeValue,
} from "./schema";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

async function guardVesselAccess(companyId: string, vesselId: string, userVesselId: string | null, isShipboard: boolean) {
  if (isShipboard && userVesselId !== vesselId) {
    return { vessel: null, error: "You can only log voyage data for your own vessel" };
  }
  const vessel = await prisma.vessel.findFirst({ where: { id: vesselId, companyId, deletedAt: null } });
  if (!vessel) return { vessel: null, error: "Vessel not found" };
  if (vessel.archivedAt) return { vessel: null, error: "This vessel is archived — the voyage log is read-only" };
  return { vessel, error: null };
}

type ParsedVoyageLog = ReturnType<typeof addVoyageLogSchema.parse> | ReturnType<typeof updateVoyageLogSchema.parse>;

type ChainedFieldsInput = {
  date: Date;
  createdAt: Date;
  reportTimeLocal: string | null;
  reportType: string;
  vesselStatus: string;
  voyageNo: string | null;
  distanceRunNm: number | null;
  engineDistanceNm: number | null;
  /** This entry's own Slip % — unaffected by the cascade (it only depends
   * on this same entry's Dist Run/Engine Distance, not on anything before
   * it), but still needed here to fold into the running Voyage Avg Slip. */
  slipPct: number | null;
  /** Whatever Observed Speed was already on record, used only when Dist
   * Run or Steaming Time isn't known and the division can't be done. */
  obsSpeedKnFallback: number | null;
  /** This entry's own submitted/stored DTG — used as-is for a Departure
   * (a genuinely fresh reading, nothing before it in this passage to
   * compute from) and as the fallback for Noon/Arrival when there's no
   * previous sailing report yet to carry a DTG forward from. */
  dtgNextPortNmFallback: number | null;
};

/** Every one of these fields is only correct relative to whatever came
 * immediately before this entry (or before it in this voyage) — pulled out
 * of toDataFields so cascadeRecomputeForward can re-run the exact same
 * derivation for every later entry after an edit, add, or delete changes
 * the chain, instead of leaving them built on stale anchors until each is
 * individually re-saved. */
async function computeChainedFields(companyId: string, vesselId: string, input: ChainedFieldsInput) {
  const before = { date: input.date, createdAt: input.createdAt };

  // Steaming Time (hrs) and DTG (nm) are both computed, not typed — elapsed
  // time and remaining distance since the last report that wasn't filed
  // While in Port (Departure, the previous Noon Position, or an Arrival),
  // same telescoping idea as Port Stay below. Only Noon Position and
  // Arrival reports carry either at all — Departure hasn't sailed yet this
  // reporting period (DTG there is a fresh manual reading with nothing to
  // carry forward from), and the form itself never shows these fields for
  // While-in-Port entries.
  let steamingTimeHrs: number | null = null;
  let dtgNextPortNm: number | null = input.dtgNextPortNmFallback;
  if (input.reportType === "NOON_AT_SEA" || input.reportType === "ARRIVAL") {
    const previousSailingReport = await getPreviousSailingReport(companyId, vesselId, before);
    if (previousSailingReport) {
      steamingTimeHrs =
        (reportDateTimeMs(input.date, input.reportTimeLocal) - reportDateTimeMs(previousSailingReport.date, previousSailingReport.reportTimeLocal)) /
        3_600_000;
      dtgNextPortNm =
        previousSailingReport.dtgNextPortNm != null ? previousSailingReport.dtgNextPortNm - (input.distanceRunNm ?? 0) : input.dtgNextPortNmFallback;
    }
  }
  // Port Stay (hrs) is computed, not typed — elapsed time since whatever
  // entry was logged immediately before this one, so the daily figure is
  // always structurally consistent with the Arrival-anchored total below
  // (they telescope). Departure also gets a Port Stay value this same way —
  // the vessel is still alongside from the last While-in-Port report until
  // the moment it actually sails.
  let portStayHrs: number | null = null;
  if (input.vesselStatus === "IN_PORT" || input.reportType === "DEPARTURE") {
    const previousEntry = await getPreviousEntry(companyId, vesselId, before);
    if (previousEntry) {
      portStayHrs = (reportDateTimeMs(input.date, input.reportTimeLocal) - reportDateTimeMs(previousEntry.date, previousEntry.reportTimeLocal)) / 3_600_000;
    }
  }

  // Observed Speed = Dist Run / Steaming Time — both are already on the
  // form for this same entry, so no reason to make the crew do the
  // division themselves. Falls back to whatever was submitted only when
  // Steaming Time isn't known (e.g. In Port entries, where it's null).
  const obsSpeedKn =
    input.distanceRunNm != null && steamingTimeHrs != null && steamingTimeHrs !== 0 ? input.distanceRunNm / steamingTimeHrs : input.obsSpeedKnFallback;

  const cumulative = await getVoyageCumulativeTotals(companyId, vesselId, input.voyageNo, before);
  const totalDistanceRunNm = cumulative.totalDistanceRunNm + (input.distanceRunNm ?? 0);
  const totalSteamingTimeHrs = cumulative.totalSteamingTimeHrs + (steamingTimeHrs ?? 0);
  const totalEngineDistanceNm = cumulative.totalEngineDistanceNm + (input.engineDistanceNm ?? 0);

  // Total Time in Port is measured from the last Arrival's own timestamp,
  // not summed from every While-in-Port entry's portStayHrs — a running sum
  // let an earlier, already-finished port call's hours bleed into the next
  // one's total once a new Arrival started the clock over. Only While-in-Port
  // and Departure entries report a total at all (Departure closes out the
  // stay that just ended); anything else has nothing to anchor to yet.
  let totalPortStayHrs: number | null = null;
  if (input.vesselStatus === "IN_PORT" || input.reportType === "DEPARTURE") {
    const lastArrival = await getLastArrival(companyId, vesselId, before);
    if (lastArrival) {
      totalPortStayHrs = (reportDateTimeMs(input.date, input.reportTimeLocal) - reportDateTimeMs(lastArrival.date, lastArrival.reportTimeLocal)) / 3_600_000;
    }
  }
  const generalAvgSpeedKn = totalSteamingTimeHrs > 0 ? totalDistanceRunNm / totalSteamingTimeHrs : null;
  const generalAvgEngineSpeedKn = totalSteamingTimeHrs > 0 ? totalEngineDistanceNm / totalSteamingTimeHrs : null;
  const slipPctCount = cumulative.priorSlipPctCount + (input.slipPct != null ? 1 : 0);
  const generalAvgSlipPct = slipPctCount > 0 ? (cumulative.priorSlipPctSum + (input.slipPct ?? 0)) / slipPctCount : null;

  return {
    steamingTimeHrs,
    dtgNextPortNm,
    portStayHrs,
    totalPortStayHrs,
    obsSpeedKn,
    totalDistanceRunNm,
    totalSteamingTimeHrs,
    totalEngineDistanceNm,
    generalAvgSpeedKn,
    generalAvgEngineSpeedKn,
    generalAvgSlipPct,
  };
}

async function toDataFields(d: ParsedVoyageLog, companyId: string, vesselId: string, before: { date: Date; createdAt: Date }) {
  // Standard nautical Slip % = (Engine Distance − Dist Run) / Engine
  // Distance × 100 — safe to auto-calculate once both inputs exist. Engine
  // Distance itself stays a manual entry (needs vessel-specific propeller
  // pitch/reduction-ratio constants this app doesn't model), so slip falls
  // back to whatever was typed when Engine Distance is blank.
  const slipPct =
    d.distanceRunNm != null && d.engineDistanceNm != null && d.engineDistanceNm !== 0
      ? ((d.engineDistanceNm - d.distanceRunNm) / d.engineDistanceNm) * 100
      : (d.slipPct ?? null);

  const chained = await computeChainedFields(companyId, vesselId, {
    date: before.date,
    createdAt: before.createdAt,
    reportTimeLocal: d.reportTimeLocal || null,
    reportType: d.reportType,
    vesselStatus: d.vesselStatus,
    voyageNo: d.voyageNo || null,
    distanceRunNm: d.distanceRunNm ?? null,
    engineDistanceNm: d.engineDistanceNm ?? null,
    slipPct,
    obsSpeedKnFallback: d.obsSpeedKn ?? null,
    dtgNextPortNmFallback: d.dtgNextPortNm ?? null,
  });
  const {
    steamingTimeHrs,
    dtgNextPortNm,
    portStayHrs,
    totalPortStayHrs,
    obsSpeedKn,
    totalDistanceRunNm,
    totalSteamingTimeHrs,
    totalEngineDistanceNm,
    generalAvgSpeedKn,
    generalAvgEngineSpeedKn,
    generalAvgSlipPct,
  } = chained;

  return {
    date: new Date(d.date),
    voyageNo: d.voyageNo || null,
    reportType: d.reportType,
    vesselStatus: d.vesselStatus,
    ladenState: d.ladenState,
    engineOrder: d.engineOrder || null,
    steamingTimeHrs,
    obsSpeedKn,
    meSpeedKn: d.meSpeedKn ?? null,
    rpm: d.rpm ?? null,
    slipPct,
    beaufortScale: d.beaufortScale ?? null,
    portStayHrs,
    totalPortStayHrs,
    offHireHrs: d.offHireHrs ?? null,

    fromPort: d.fromPort || null,
    nextPort: d.nextPort || null,
    course: d.course || null,
    zoneDescription: d.zoneDescription || null,
    reportTimeLocal: d.reportTimeLocal || null,
    position: d.position || null,
    draftFwdM: d.draftFwdM ?? null,
    draftAftM: d.draftAftM ?? null,
    draftMeanM: d.draftMeanM ?? null,

    distanceRunNm: d.distanceRunNm ?? null,
    totalDistanceRunNm,
    dtgNextPortNm,
    totalSteamingTimeHrs,
    distanceLogNm: d.distanceLogNm ?? null,
    generalAvgSpeedKn,
    engineDistanceNm: d.engineDistanceNm ?? null,
    totalEngineDistanceNm,
    generalAvgEngineSpeedKn,
    weatherCondition: d.weatherCondition || null,
    generalAvgSlipPct,
    barometer: d.barometer ?? null,
    exhaustTempUnit: d.exhaustTempUnit || null,
    exhaustGasTemp: d.exhaustGasTemp || null,

    etaNextPortDate: d.etaNextPortDate ? new Date(d.etaNextPortDate) : null,
    etaNextPortTime: d.etaNextPortTime || null,
    etaNextPortZd: d.etaNextPortZd || null,

    cargoOnboard: d.cargoOnboard || null,
    cargoToDiscLoaded: d.cargoToDiscLoaded || null,
    blQuantity: d.blQuantity ?? null,
    cargoTemp: d.cargoTemp || null,
    agentName: d.agentName || null,
    agentTel: d.agentTel || null,
    agentFax: d.agentFax || null,
    agentEmail: d.agentEmail || null,
    agentAddress: d.agentAddress || null,
    deckDeptReport: d.deckDeptReport || null,
    engineDeptReport: d.engineDeptReport || null,
    statementOfFacts: d.statementOfFacts || null,
    master: d.master || null,
    chiefEngineer: d.chiefEngineer || null,

    remarks: d.remarks || null,
  };
}

/** Departure is the last chance to record what's actually onboard and what
 * happened in port before the vessel sails — Cargo Onboard and Statement of
 * Facts routinely get skipped otherwise because neither blocks any other
 * field from being filled in. Enforced here as the authoritative check (the
 * form's own required-field/banner nudges are just a head start on this same
 * rule, not a substitute for it — a direct POST or JS-disabled submit still
 * has to pass through here). */
function validateDepartureRequiredFields(d: { reportType: string; cargoOnboard?: string; statementOfFacts?: string }): string | null {
  if (d.reportType !== "DEPARTURE") return null;
  const missing: string[] = [];
  if (!d.cargoOnboard?.trim()) missing.push("Type of Cargo Onboard");
  if (!d.statementOfFacts?.trim()) missing.push("Statement of Facts");
  if (missing.length === 0) return null;
  return `${missing.join(" and ")} ${missing.length > 1 ? "are" : "is"} required for a Departure report.`;
}

type BunkerRow = { companyId: string; grade: BunkerGradeValue; previous: number | null; consumed: number | null; received: number | null; rob: number | null };

/** Consumed is never trusted from the client — it's derived here as
 * Previous + Received − Current ROB. A grade with no Previous/Received/ROB
 * submitted at all is skipped (only grades the vessel actually touched get
 * a row). A negative result means the crew's Current ROB is higher than
 * what should be available — blocked before anything is written, since
 * letting it through would poison every later report's carry-forward
 * chain for that grade. */
function buildBunkerRows(d: Record<string, unknown>, companyId: string): { rows: BunkerRow[]; error: string | null } {
  const num = (key: string): number | null => {
    const v = d[key];
    return typeof v === "number" ? v : null;
  };
  const rows: BunkerRow[] = [];
  for (const grade of BUNKER_GRADES) {
    const previous = num(bunkerFieldName(grade, "previous"));
    const received = num(bunkerFieldName(grade, "received"));
    const rob = num(bunkerFieldName(grade, "rob"));
    if (previous === null && received === null && rob === null) continue;
    // No Previous on file yet (this vessel/grade's very first entry) means
    // there's no real baseline to validate against — treating a missing
    // Previous as 0 would falsely flag a fresh bunkering as "negative
    // consumption." Consumed simply isn't computable yet in that case.
    const consumed = previous != null ? previous + (received ?? 0) - (rob ?? 0) : null;
    if (consumed != null && consumed < 0) {
      return {
        rows: [],
        error: `Current ROB is greater than available ROB for ${BUNKER_GRADE_LABELS[grade]}. Please verify ROB / Bunker Received.`,
      };
    }
    rows.push({ companyId, grade, previous, consumed, received, rob });
  }
  return { rows, error: null };
}

/** Every derived field (Steaming Time, Port Stay, DTG, their Totals,
 * Observed Speed, and the Voyage/Performance averages) is only correct
 * relative to whatever came immediately before that entry — editing an
 * earlier entry's Report Time, Date, report type/status, or raw figures,
 * adding a backdated entry into the middle of the chain, or deleting one,
 * all leave every later entry's own derived figures built on the OLD chain
 * until they're individually re-saved. Re-derives them here instead,
 * walking forward from the entry that just changed and re-running the
 * exact same computeChainedFields each of them was originally saved with —
 * each entry's own raw inputs (Report Time, Dist Run, etc.) are left
 * untouched, only the columns that depend on something earlier get
 * overwritten. A Departure's own DTG is a fresh manual reading with
 * nothing before it to compute from, so computeChainedFields naturally
 * leaves it alone (falls back to its own already-stored value) without
 * this needing to special-case it. */
async function cascadeRecomputeForward(companyId: string, vesselId: string, after: { date: Date; createdAt: Date }) {
  const later = await prisma.voyageLog.findMany({
    where: {
      companyId,
      vesselId,
      deletedAt: null,
      OR: [{ date: { gt: after.date } }, { date: after.date, createdAt: { gt: after.createdAt } }],
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      date: true,
      createdAt: true,
      reportTimeLocal: true,
      reportType: true,
      vesselStatus: true,
      voyageNo: true,
      distanceRunNm: true,
      engineDistanceNm: true,
      slipPct: true,
      obsSpeedKn: true,
      dtgNextPortNm: true,
    },
  });

  // Sequential, not parallel — a later entry's own cumulative totals depend
  // on the entries before it (within the same voyage) already reflecting
  // their freshly-recomputed values, so each write has to land before the
  // next entry's own recompute reads it back out.
  for (const entry of later) {
    const chained = await computeChainedFields(companyId, vesselId, {
      date: entry.date,
      createdAt: entry.createdAt,
      reportTimeLocal: entry.reportTimeLocal,
      reportType: entry.reportType,
      vesselStatus: entry.vesselStatus,
      voyageNo: entry.voyageNo,
      distanceRunNm: entry.distanceRunNm,
      engineDistanceNm: entry.engineDistanceNm,
      slipPct: entry.slipPct,
      obsSpeedKnFallback: entry.obsSpeedKn,
      dtgNextPortNmFallback: entry.dtgNextPortNm,
    });
    await prisma.voyageLog.update({
      where: { id: entry.id },
      data: {
        steamingTimeHrs: chained.steamingTimeHrs,
        dtgNextPortNm: chained.dtgNextPortNm,
        portStayHrs: chained.portStayHrs,
        totalPortStayHrs: chained.totalPortStayHrs,
        obsSpeedKn: chained.obsSpeedKn,
        totalDistanceRunNm: chained.totalDistanceRunNm,
        totalSteamingTimeHrs: chained.totalSteamingTimeHrs,
        totalEngineDistanceNm: chained.totalEngineDistanceNm,
        generalAvgSpeedKn: chained.generalAvgSpeedKn,
        generalAvgEngineSpeedKn: chained.generalAvgEngineSpeedKn,
        generalAvgSlipPct: chained.generalAvgSlipPct,
      },
    });
  }
}

export async function addVoyageLogAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("vtracker:create");
  const parsed = addVoyageLogSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const departureError = validateDepartureRequiredFields(d);
  if (departureError) return fail(departureError);

  const { vessel, error } = await guardVesselAccess(user.companyId, d.vesselId, user.vesselId, user.department === "SHIPBOARD");
  if (!vessel) return fail(error ?? "Vessel not found");

  const { rows: bunkerRows, error: bunkerError } = buildBunkerRows(d, user.companyId);
  if (bunkerError) return fail(bunkerError);

  const createdAt = new Date();
  const dataFields = await toDataFields(d, user.companyId, d.vesselId, { date: new Date(d.date), createdAt });
  const entry = await prisma.voyageLog.create({
    data: {
      companyId: user.companyId,
      vesselId: d.vesselId,
      createdBy: user.id,
      updatedBy: user.id,
      ...dataFields,
      bunkers: { create: bunkerRows },
    },
  });

  // Only matters for a backdated entry inserted into the middle of the
  // chain — a normal same-day add has nothing after it yet.
  await cascadeRecomputeForward(user.companyId, d.vesselId, { date: new Date(d.date), createdAt });

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "VoyageLog",
    entityId: entry.id,
    summary: `Logged voyage entry for ${vessel.name} — ${d.date}`,
  });

  revalidatePath(`/vessel-tracker/${d.vesselId}`);
  revalidatePath("/vessel-tracker");
  return OK;
}

export async function updateVoyageLogAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("vtracker:update");
  const parsed = updateVoyageLogSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const departureError = validateDepartureRequiredFields(d);
  if (departureError) return fail(departureError);

  const existing = await prisma.voyageLog.findFirst({ where: { id: d.entryId, companyId: user.companyId, deletedAt: null } });
  if (!existing) return fail("Voyage log entry not found");

  const { vessel, error } = await guardVesselAccess(user.companyId, existing.vesselId, user.vesselId, user.department === "SHIPBOARD");
  if (!vessel) return fail(error ?? "Vessel not found");

  const { rows: bunkerRows, error: bunkerError } = buildBunkerRows(d, user.companyId);
  if (bunkerError) return fail(bunkerError);

  const dataFields = await toDataFields(d, user.companyId, existing.vesselId, { date: new Date(d.date), createdAt: existing.createdAt });
  await prisma.$transaction([
    prisma.voyageLogBunker.deleteMany({ where: { voyageLogId: d.entryId } }),
    prisma.voyageLog.update({
      where: { id: d.entryId },
      data: {
        updatedBy: user.id,
        ...dataFields,
        bunkers: { create: bunkerRows },
      },
    }),
  ]);

  // A correction here (Report Time, Dist Run, report type — anything the
  // chain depends on) would otherwise leave every later entry still built
  // on the old values. Cascades from whichever is earlier of this entry's
  // old or new Date, in case the edit also moved the entry itself earlier
  // or later in the timeline — entries between the two positions need
  // their anchors re-checked either way.
  const cascadeFromDate = existing.date < new Date(d.date) ? existing.date : new Date(d.date);
  await cascadeRecomputeForward(user.companyId, existing.vesselId, { date: cascadeFromDate, createdAt: existing.createdAt });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "VoyageLog",
    entityId: d.entryId,
    summary: `Updated voyage entry for ${vessel.name} — ${d.date}`,
  });

  revalidatePath(`/vessel-tracker/${existing.vesselId}`);
  revalidatePath("/vessel-tracker");
  return OK;
}

export async function deleteVoyageLogAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("vtracker:delete");
  const parsed = deleteVoyageLogSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Invalid request");

  const existing = await prisma.voyageLog.findFirst({ where: { id: parsed.data.entryId, companyId: user.companyId, deletedAt: null } });
  if (!existing) return fail("Voyage log entry not found");

  await prisma.voyageLog.update({
    where: { id: existing.id },
    data: { deletedAt: new Date(), deletedBy: user.id },
  });

  // Removing an entry from the middle of the chain leaves every later one
  // still anchored on it — deletedAt: null already excludes it from the
  // lookups computeChainedFields uses, so this just needs to re-run them.
  await cascadeRecomputeForward(user.companyId, existing.vesselId, { date: existing.date, createdAt: existing.createdAt });

  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "VoyageLog",
    entityId: existing.id,
    summary: `Deleted voyage entry dated ${existing.date.toISOString().slice(0, 10)}`,
  });

  revalidatePath(`/vessel-tracker/${existing.vesselId}`);
  revalidatePath("/vessel-tracker");
  return OK;
}
