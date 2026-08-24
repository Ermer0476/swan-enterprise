import "server-only";
import { prisma } from "@/lib/prisma";
import { paginationArgs, paginate, type Paginated } from "@/lib/pagination";
import { foDoTotals, lubeOilTotals, reportDateTimeMs, type BunkerGradeValue, type VoyageReportTypeValue } from "./schema";

export type VoyageLogRow = Awaited<ReturnType<typeof listVoyageLogsForVessel>>[number];

export async function listVoyageLogsForVessel(companyId: string, vesselId: string, range?: { from: Date; to: Date }) {
  return prisma.voyageLog.findMany({
    where: {
      companyId,
      vesselId,
      deletedAt: null,
      ...(range && { date: { gte: range.from, lte: range.to } }),
    },
    include: { bunkers: true },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });
}

/** Paginated view of a vessel's voyage log for the table on the vessel
 * detail page — getVoyageKpis below still fetches the full unbounded set
 * for the same range, since its totals must cover every entry in the
 * period, not just the current page. */
export async function listVoyageLogsForVesselPaginated(
  companyId: string,
  vesselId: string,
  range: { from: Date; to: Date },
  page: number,
): Promise<Paginated<VoyageLogRow>> {
  const where = {
    companyId,
    vesselId,
    deletedAt: null,
    date: { gte: range.from, lte: range.to },
  };
  const [rows, total] = await Promise.all([
    prisma.voyageLog.findMany({
      where,
      include: { bunkers: true },
      orderBy: [{ date: "asc" as const }, { createdAt: "asc" as const }],
      ...paginationArgs(page),
    }),
    prisma.voyageLog.count({ where }),
  ]);
  return paginate(rows, total, page);
}

export async function getVoyageLogEntry(companyId: string, entryId: string) {
  return prisma.voyageLog.findFirst({
    where: { id: entryId, companyId, deletedAt: null },
    include: { vessel: { select: { id: true, name: true, code: true, type: true } }, bunkers: true },
  });
}

/** One row per vessel with a voyage log — last entry's date/status, for the
 * fleet list page's at-a-glance column. Vessels with zero entries yet are
 * shown separately by the caller (all vessels minus this list).
 * `vesselId` — pass the caller's own vessel id when the caller is SHIPBOARD
 * to restrict the "fleet" list down to just that one vessel's row; omit for
 * OFFICE callers, who see every vessel. */
export async function listFleetLastEntries(companyId: string, vesselId?: string) {
  const vessels = await prisma.vessel.findMany({
    where: { companyId, deletedAt: null, status: "ACTIVE", ...(vesselId ? { id: vesselId } : {}) },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  const lastEntries = await prisma.voyageLog.findMany({
    where: { companyId, deletedAt: null, vesselId: { in: vessels.map((v) => v.id) } },
    orderBy: { date: "desc" },
    distinct: ["vesselId"],
    select: { vesselId: true, date: true, vesselStatus: true, ladenState: true, engineOrder: true, fromPort: true, nextPort: true, reportType: true },
  });
  const byVessel = new Map(lastEntries.map((e) => [e.vesselId, e]));

  return vessels.map((v) => ({ vessel: v, lastEntry: byVessel.get(v.id) ?? null }));
}

/** All entries in a month, grouped by vessel — powers the fleet calendar
 * grid (vessels as rows, days as columns), same shape as the office's
 * existing Vessel Tracker Calendar View. Only vessels with at least one
 * entry that month come back; the fleet list page shows the rest via
 * listFleetLastEntries so every vessel is still reachable. */
export async function getFleetCalendarMonth(companyId: string, from: Date, to: Date, vesselId?: string) {
  const rows = await prisma.voyageLog.findMany({
    where: { companyId, deletedAt: null, date: { gte: from, lte: to }, ...(vesselId ? { vesselId } : {}) },
    // createdAt as a secondary sort matters here: a day often has more than
    // one report (e.g. Departure then Noon Position), and the calendar's
    // "last entry" for that day — used for the current status icons — needs
    // to reliably mean "most recently logged," not whatever order Postgres
    // happens to return same-date rows in.
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    include: { vessel: { select: { id: true, name: true, code: true } } },
  });

  const byVessel = new Map<string, { vessel: { id: string; name: string; code: string }; days: Map<number, typeof rows> }>();
  for (const row of rows) {
    let entry = byVessel.get(row.vesselId);
    if (!entry) {
      entry = { vessel: row.vessel, days: new Map() };
      byVessel.set(row.vesselId, entry);
    }
    const day = row.date.getUTCDate();
    const existing = entry.days.get(day) ?? [];
    existing.push(row);
    entry.days.set(day, existing);
  }
  return Array.from(byVessel.values()).sort((a, b) => a.vessel.name.localeCompare(b.vessel.name));
}

export type VoyageKpis = {
  totalDistanceNm: number;
  avgObsSpeedKn: number | null;
  totalFoMt: number;
  totalDoMt: number;
  totalSteamingHrs: number;
  totalPortStayHrs: number;
  offHireHrs: number;
  daysSailing: number;
  daysInPort: number;
  entryCount: number;
};

/** Simple period aggregates for a vessel's voyage log — average speed only
 * counts days it was actually reported (blank cells on partial legs don't
 * drag the average toward zero). */
export async function getVoyageKpis(companyId: string, vesselId: string, range: { from: Date; to: Date }): Promise<VoyageKpis> {
  const rows = await listVoyageLogsForVessel(companyId, vesselId, range);

  const speeds = rows.map((r) => r.obsSpeedKn).filter((v): v is number => v != null);
  const totals = rows.reduce(
    (acc, r) => {
      const { foTotalMt, doTotalMt } = foDoTotals(r.bunkers);
      acc.totalDistanceNm += r.distanceRunNm ?? 0;
      acc.totalFoMt += foTotalMt;
      acc.totalDoMt += doTotalMt;
      acc.totalSteamingHrs += r.steamingTimeHrs ?? 0;
      acc.totalPortStayHrs += r.portStayHrs ?? 0;
      acc.offHireHrs += r.offHireHrs ?? 0;
      if (r.vesselStatus === "IN_PORT") acc.daysInPort++;
      else acc.daysSailing++;
      return acc;
    },
    { totalDistanceNm: 0, totalFoMt: 0, totalDoMt: 0, totalSteamingHrs: 0, totalPortStayHrs: 0, offHireHrs: 0, daysSailing: 0, daysInPort: 0 },
  );

  return {
    ...totals,
    avgObsSpeedKn: speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : null,
    entryCount: rows.length,
  };
}

export type VoyagePerformance = {
  voyageNo: string;
  firstDate: string; // yyyy-mm-dd, for ordering/labelling
  avgSpeedKn: number | null;
  avgBeaufort: number | null;
  /** Whichever laden state most of this voyage's entries were logged
   * under — a voyage can carry both (e.g. laden leg out, ballast back), so
   * this is "predominant," not "the only one." */
  ladenState: "LADEN" | "BALLAST";
  foTotalMt: number;
  doTotalMt: number;
};

/** One row per voyage number (chronological) — powers the per-voyage
 * speed/consumption charts on the vessel detail page. Entries with no
 * Voy No. logged (e.g. a lone in-port day before a voyage number was
 * assigned) are grouped under "—" rather than dropped. */
export async function getVoyagePerformance(companyId: string, vesselId: string, range: { from: Date; to: Date }): Promise<VoyagePerformance[]> {
  const rows = await listVoyageLogsForVessel(companyId, vesselId, range);

  const byVoyage = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = r.voyageNo ?? "—";
    const existing = byVoyage.get(key) ?? [];
    existing.push(r);
    byVoyage.set(key, existing);
  }

  const result: VoyagePerformance[] = [];
  for (const [voyageNo, voyageRows] of byVoyage) {
    const speeds = voyageRows.map((r) => r.obsSpeedKn).filter((v): v is number => v != null);
    const beauforts = voyageRows.map((r) => r.beaufortScale).filter((v): v is number => v != null);
    const ladenCount = voyageRows.filter((r) => r.ladenState === "LADEN").length;
    const totals = voyageRows.reduce(
      (acc, r) => {
        const { foTotalMt, doTotalMt } = foDoTotals(r.bunkers);
        acc.foTotalMt += foTotalMt;
        acc.doTotalMt += doTotalMt;
        return acc;
      },
      { foTotalMt: 0, doTotalMt: 0 },
    );
    result.push({
      voyageNo,
      firstDate: voyageRows[0]!.date.toISOString().slice(0, 10),
      avgSpeedKn: speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : null,
      avgBeaufort: beauforts.length > 0 ? beauforts.reduce((a, b) => a + b, 0) / beauforts.length : null,
      ladenState: ladenCount >= voyageRows.length / 2 ? "LADEN" : "BALLAST",
      ...totals,
    });
  }
  return result.sort((a, b) => a.firstDate.localeCompare(b.firstDate));
}

export type VoyageMonthlyTime = { year: number; month: number; steamingHrs: number; portStayHrs: number };

/** Underway vs In-Port hours bucketed by calendar month — the single-period
 * donut on the KPI dashboard collapses everything into one pair of numbers,
 * which hides the month-to-month shape once the selected range spans more
 * than one month (Quarterly/Yearly view). UTC month/year, same convention
 * as getFleetCalendarMonth elsewhere in this file. */
export async function getVoyageMonthlyTime(companyId: string, vesselId: string, range: { from: Date; to: Date }): Promise<VoyageMonthlyTime[]> {
  const rows = await listVoyageLogsForVessel(companyId, vesselId, range);

  const byMonth = new Map<string, VoyageMonthlyTime>();
  for (const r of rows) {
    const year = r.date.getUTCFullYear();
    const month = r.date.getUTCMonth() + 1;
    const key = `${year}-${month}`;
    let bucket = byMonth.get(key);
    if (!bucket) {
      bucket = { year, month, steamingHrs: 0, portStayHrs: 0 };
      byMonth.set(key, bucket);
    }
    bucket.steamingHrs += r.steamingTimeHrs ?? 0;
    bucket.portStayHrs += r.portStayHrs ?? 0;
  }

  return Array.from(byMonth.values()).sort((a, b) => (a.year === b.year ? a.month - b.month : a.year - b.year));
}

export type VoyageMonthlyLubeOil = { year: number; month: number; cylOilMt: number; meloMt: number; geloMt: number };

/** Lube oil (Cyl Oil / MELO / GELO) consumed per calendar month — same
 * month-bucketing convention as getVoyageMonthlyTime above. Kept as a
 * separate query (not folded into fuel rate) since lube oil consumption
 * doesn't need the per-report 24h-normalization fuel does: unlike FO/DO,
 * there's no sea-trial "standard" being compared against here, just a
 * simple monthly total per grade. */
export async function getVoyageMonthlyLubeOil(companyId: string, vesselId: string, range: { from: Date; to: Date }): Promise<VoyageMonthlyLubeOil[]> {
  const rows = await listVoyageLogsForVessel(companyId, vesselId, range);

  const byMonth = new Map<string, VoyageMonthlyLubeOil>();
  for (const r of rows) {
    const year = r.date.getUTCFullYear();
    const month = r.date.getUTCMonth() + 1;
    const key = `${year}-${month}`;
    let bucket = byMonth.get(key);
    if (!bucket) {
      bucket = { year, month, cylOilMt: 0, meloMt: 0, geloMt: 0 };
      byMonth.set(key, bucket);
    }
    const { cylOilMt, meloMt, geloMt } = lubeOilTotals(r.bunkers);
    bucket.cylOilMt += cylOilMt;
    bucket.meloMt += meloMt;
    bucket.geloMt += geloMt;
  }

  return Array.from(byMonth.values()).sort((a, b) => (a.year === b.year ? a.month - b.month : a.year - b.year));
}

export type VoyageFuelRatePoint = {
  date: string;
  reportTimeLocal: string | null;
  reportType: VoyageReportTypeValue;
  hoursCovered: number;
  foRateMtPerDay: number;
  doRateMtPerDay: number;
};

/** F.O./D.O. consumption normalized to a 24h-equivalent rate per REPORT, not
 * summed per calendar day. A report's `consumed` bunker figure covers
 * however many hours actually elapsed since the previous report — a Noon
 * report covers ~24h, but a same-day Arrival right after it might cover only
 * ~11h. Bucketing both under one calendar day would attribute up to ~35h of
 * real fuel burn to a single "day", inflating the figure well past the
 * vessel's true daily rate and past the sea-trial standard it's compared
 * against (see components/vessel-tracker's KPI dashboard). Scaling each
 * report to what it would be over a full 24h keeps every point comparable
 * regardless of how long that particular report's period actually was. The
 * anchor for the very first report in range is fetched from just before
 * `range.from` so that report isn't penalized for starting a fresh window;
 * a report with no prior anchor at all (vessel's first-ever entry) is
 * skipped rather than guessed at. */
export async function getVoyageFuelRate(companyId: string, vesselId: string, range: { from: Date; to: Date }): Promise<VoyageFuelRatePoint[]> {
  const anchor = await prisma.voyageLog.findFirst({
    where: { companyId, vesselId, deletedAt: null, date: { lt: range.from } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: { date: true, reportTimeLocal: true },
  });

  const rows = await listVoyageLogsForVessel(companyId, vesselId, range);

  const points: VoyageFuelRatePoint[] = [];
  let prevMs = anchor ? reportDateTimeMs(anchor.date, anchor.reportTimeLocal) : null;
  for (const r of rows) {
    const curMs = reportDateTimeMs(r.date, r.reportTimeLocal);
    const hoursCovered = prevMs !== null ? (curMs - prevMs) / 3_600_000 : null;
    prevMs = curMs;
    if (!hoursCovered || hoursCovered <= 0) continue;
    const { foTotalMt, doTotalMt } = foDoTotals(r.bunkers);
    points.push({
      date: r.date.toISOString().slice(0, 10),
      reportTimeLocal: r.reportTimeLocal,
      reportType: r.reportType,
      hoursCovered,
      foRateMtPerDay: (foTotalMt / hoursCovered) * 24,
      doRateMtPerDay: (doTotalMt / hoursCovered) * 24,
    });
  }
  return points;
}

export type BunkerCarryForward = {
  previous: Partial<Record<BunkerGradeValue, number>>;
  avgConsumed: Partial<Record<BunkerGradeValue, number>>;
};

function median(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const lo = sorted[mid - 1];
  const hi = sorted[mid];
  return sorted.length % 2 === 0 && lo != null && hi != null ? (lo + hi) / 2 : (hi ?? lo ?? 0);
}

/** Powers the Add-entry form's auto-filled "Previous" ROB per grade — the
 * vessel should never have to retype yesterday's closing ROB. Also returns
 * each grade's typical consumption (median of the last up to 5 entries),
 * used only as a soft "this looks unusually high" hint on the client —
 * never to block anything, matching the spec's warning-only wording for
 * that case. Median rather than a plain mean — a single one-off bunkering
 * event in a grade's recent history (e.g. a real 11,000+ delivery/topping-up
 * entry) would otherwise drag a mean so high that the threshold stops
 * catching anything, exactly the failure mode that made this grade's
 * warning go silent for entries that genuinely looked off. */
export async function getBunkerCarryForward(companyId: string, vesselId: string): Promise<BunkerCarryForward> {
  const rows = await prisma.voyageLogBunker.findMany({
    where: { companyId, voyageLog: { vesselId, companyId, deletedAt: null } },
    orderBy: [{ voyageLog: { date: "desc" } }, { voyageLog: { createdAt: "desc" } }],
    take: 300,
    select: { grade: true, rob: true, consumed: true },
  });

  const previous: Partial<Record<BunkerGradeValue, number>> = {};
  const consumedSamples = new Map<BunkerGradeValue, number[]>();
  for (const row of rows) {
    if (!(row.grade in previous) && row.rob != null) previous[row.grade] = row.rob;
    if (row.consumed != null) {
      const samples = consumedSamples.get(row.grade) ?? [];
      if (samples.length < 5) samples.push(row.consumed);
      consumedSamples.set(row.grade, samples);
    }
  }

  const avgConsumed: Partial<Record<BunkerGradeValue, number>> = {};
  for (const [grade, samples] of consumedSamples) {
    avgConsumed[grade] = median(samples);
  }

  return { previous, avgConsumed };
}

export type BunkerRobSnapshot = {
  date: string;
  reportType: VoyageReportTypeValue;
  robByGrade: Partial<Record<BunkerGradeValue, number>>;
};

/** Recent whole-report ROB snapshots (every grade's ROB as recorded on one
 * particular report) so the crew can pick a single past entry — e.g. the
 * vessel's own Arrival report — as "Previous" for every grade at once,
 * instead of always chaining off whichever daily in-port report happened
 * to be logged most recently while alongside, or picking grade-by-grade. */
export async function getBunkerRobHistory(companyId: string, vesselId: string): Promise<BunkerRobSnapshot[]> {
  const logs = await prisma.voyageLog.findMany({
    where: { companyId, vesselId, deletedAt: null },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 20,
    select: { date: true, reportType: true, bunkers: { select: { grade: true, rob: true } } },
  });

  return logs
    .map((log) => {
      const robByGrade: Partial<Record<BunkerGradeValue, number>> = {};
      for (const b of log.bunkers) {
        if (b.rob != null) robByGrade[b.grade] = b.rob;
      }
      return { date: log.date.toISOString().slice(0, 10), reportType: log.reportType, robByGrade };
    })
    .filter((snapshot) => Object.keys(snapshot.robByGrade).length > 0);
}

export type LastEntryCarryForward = {
  voyageNo: string;
  fromPort: string;
  nextPort: string;
  zoneDescription: string;
  draftFwdM: string;
  draftAftM: string;
  dtgNextPortNm: string;
  cargoOnboard: string;
  cargoToDiscLoaded: string;
  blQuantity: string;
};

/** Pre-fills the Add-entry form from the vessel's own last saved report —
 * Voy No., From/Next Port, ZD, Draft, Distance To Go, and the cargo figures
 * (Onboard / to Disc-Loaded / BL Quantity) rarely change between
 * consecutive daily reports on the same passage — cargo ops only move the
 * needle at Departure/Arrival/In-Port, not report to report at sea — so the
 * crew only has to correct what's actually different instead of retyping
 * everything from a blank form. DTG in particular starts from whatever the
 * Departure report recorded and is expected to be corrected downward
 * report-by-report as the vessel closes on the next port — carrying
 * forward the immediately preceding entry's value (Departure or otherwise)
 * gives the crew that starting point instead of a blank box. Cargo Temp is
 * deliberately NOT carried forward here — unlike quantity, it's a fresh
 * reading every report, so a stale carried-over temperature would be
 * actively misleading rather than a convenience. */
export async function getLastEntryCarryForward(companyId: string, vesselId: string): Promise<LastEntryCarryForward | null> {
  const last = await prisma.voyageLog.findFirst({
    where: { companyId, vesselId, deletedAt: null },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: {
      voyageNo: true,
      fromPort: true,
      nextPort: true,
      zoneDescription: true,
      draftFwdM: true,
      draftAftM: true,
      dtgNextPortNm: true,
      cargoOnboard: true,
      cargoToDiscLoaded: true,
      blQuantity: true,
    },
  });
  if (!last) return null;
  return {
    voyageNo: last.voyageNo ?? "",
    fromPort: last.fromPort ?? "",
    nextPort: last.nextPort ?? "",
    zoneDescription: last.zoneDescription ?? "",
    draftFwdM: last.draftFwdM != null ? String(last.draftFwdM) : "",
    cargoOnboard: last.cargoOnboard ?? "",
    cargoToDiscLoaded: last.cargoToDiscLoaded ?? "",
    blQuantity: last.blQuantity != null ? String(last.blQuantity) : "",
    draftAftM: last.draftAftM != null ? String(last.draftAftM) : "",
    dtgNextPortNm: last.dtgNextPortNm != null ? String(last.dtgNextPortNm) : "",
  };
}

export type VoyageCumulativeTotals = {
  totalDistanceRunNm: number;
  totalSteamingTimeHrs: number;
  totalEngineDistanceNm: number;
  /** Sum/count of prior entries' slipPct, for computing a running average
   * once this entry's own value is added — a plain running sum can't be
   * divided back into an average without the count. */
  priorSlipPctSum: number;
  priorSlipPctCount: number;
};

/** The most recent Departure entry for this vessel+voyage, strictly before
 * the given (date, createdAt) position if one is supplied — the anchor
 * point Distance Run / Steaming Time / Engine Distance / Slip totals are
 * measured from. A voyage number can span more than one sailing leg (a
 * port call in the middle, then departing again), and without resetting at
 * each Departure those totals would keep growing across legs instead of
 * describing "this passage" the way the crew's own Excel sheet does. */
export async function getLastDeparture(
  companyId: string,
  vesselId: string,
  voyageNo: string | null,
  before?: { date: Date; createdAt: Date },
): Promise<{ date: Date; createdAt: Date } | null> {
  return prisma.voyageLog.findFirst({
    where: {
      companyId,
      vesselId,
      voyageNo,
      reportType: "DEPARTURE",
      deletedAt: null,
      ...(before ? { OR: [{ date: { lt: before.date } }, { date: before.date, createdAt: { lt: before.createdAt } }] } : {}),
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: { date: true, createdAt: true },
  });
}

/** Sums this vessel's same-voyage entries from the last Departure (inclusive)
 * up to the given (date, createdAt) position (exclusive) — the "everything
 * so far this leg" base that addVoyageLogAction/updateVoyageLogAction add
 * this entry's own raw values onto, to get the running Total X the crew
 * never has to retype. Resets at each Departure rather than running for the
 * whole voyageNo (see getLastDeparture). Entries with no Voy No. are
 * grouped together via voyageNo: null, matching getVoyagePerformance's "—"
 * bucketing. */
export async function getVoyageCumulativeTotals(
  companyId: string,
  vesselId: string,
  voyageNo: string | null,
  before: { date: Date; createdAt: Date },
): Promise<VoyageCumulativeTotals> {
  const lastDeparture = await getLastDeparture(companyId, vesselId, voyageNo, before);
  const rows = await prisma.voyageLog.findMany({
    where: {
      companyId,
      vesselId,
      voyageNo,
      deletedAt: null,
      AND: [
        lastDeparture
          ? { OR: [{ date: { gt: lastDeparture.date } }, { date: lastDeparture.date, createdAt: { gte: lastDeparture.createdAt } }] }
          : {},
        { OR: [{ date: { lt: before.date } }, { date: before.date, createdAt: { lt: before.createdAt } }] },
      ],
    },
    select: { distanceRunNm: true, steamingTimeHrs: true, engineDistanceNm: true, slipPct: true },
  });

  return sumCumulativeRows(rows);
}

function sumCumulativeRows(
  rows: {
    distanceRunNm: number | null;
    steamingTimeHrs: number | null;
    engineDistanceNm: number | null;
    slipPct: number | null;
  }[],
): VoyageCumulativeTotals {
  return rows.reduce(
    (acc, r) => {
      acc.totalDistanceRunNm += r.distanceRunNm ?? 0;
      acc.totalSteamingTimeHrs += r.steamingTimeHrs ?? 0;
      acc.totalEngineDistanceNm += r.engineDistanceNm ?? 0;
      if (r.slipPct != null) {
        acc.priorSlipPctSum += r.slipPct;
        acc.priorSlipPctCount += 1;
      }
      return acc;
    },
    { totalDistanceRunNm: 0, totalSteamingTimeHrs: 0, totalEngineDistanceNm: 0, priorSlipPctSum: 0, priorSlipPctCount: 0 },
  );
}

/** The most recent Arrival entry for this vessel, strictly before the given
 * (date, createdAt) position if one is supplied — the anchor point Total
 * Time in Port is measured from. Deliberately NOT scoped by voyage number:
 * this fleet's convention increments the voyage number AT the Departure
 * that ends a port stay, so the Arrival/While-in-Port entries that stay
 * measures against are always under the OLD (different) voyage number —
 * filtering by voyageNo here would make the anchor unfindable for the
 * first Departure of every new voyage. Deliberately NOT a running sum of
 * every While-in-Port entry's own portStayHrs either: summing blindly let
 * an earlier, unrelated port call (before the last Arrival) bleed its
 * hours into the current one's total. Resetting at each Arrival and
 * measuring real elapsed time (this entry's Date+Report Time minus the
 * Arrival's) can't drift that way. */
export async function getLastArrival(
  companyId: string,
  vesselId: string,
  before?: { date: Date; createdAt: Date },
): Promise<{ date: Date; createdAt: Date; reportTimeLocal: string | null } | null> {
  return prisma.voyageLog.findFirst({
    where: {
      companyId,
      vesselId,
      reportType: "ARRIVAL",
      deletedAt: null,
      ...(before ? { OR: [{ date: { lt: before.date } }, { date: before.date, createdAt: { lt: before.createdAt } }] } : {}),
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: { date: true, createdAt: true, reportTimeLocal: true },
  });
}

/** The immediately preceding entry (any report type) for this vessel before
 * the given (date, createdAt) — the anchor Port Stay (hrs) is auto-computed
 * from, so the crew never has to type a figure that can disagree with the
 * Report Times on either side of it. Whatever came right before (the last
 * Arrival on day one of a stay, or yesterday's own While-in-Port report on
 * later days) is always the correct anchor, since Departure always closes
 * out the block and Arrival always opens the next one. Not scoped by
 * voyage number, same reasoning as getLastArrival above — a Departure's
 * own voyage number is already the NEW one, but its Port Stay anchor is
 * the last entry of the OLD voyage. */
export async function getPreviousEntry(
  companyId: string,
  vesselId: string,
  before?: { date: Date; createdAt: Date },
): Promise<{ date: Date; reportTimeLocal: string | null } | null> {
  return prisma.voyageLog.findFirst({
    where: {
      companyId,
      vesselId,
      deletedAt: null,
      ...(before ? { OR: [{ date: { lt: before.date } }, { date: before.date, createdAt: { lt: before.createdAt } }] } : {}),
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: { date: true, reportTimeLocal: true },
  });
}

/** The most recent non-"While in Port" entry for this vessel before the
 * given (date, createdAt) — the anchor Steaming Time (hrs) AND DTG (nm) are
 * both auto-computed from on a Noon Position/Arrival report, the same
 * telescoping idea as getPreviousEntry above for Port Stay. Whatever the
 * vessel was doing between two consecutive sailing reports (Departure→Noon,
 * Noon→Noon, Noon→Arrival) is exactly the elapsed time this report needs to
 * account for, and its own DTG is exactly what this report's DTG starts
 * from before subtracting today's Dist Run; a While-in-Port entry in
 * between would mean the vessel wasn't sailing (or going anywhere) at all
 * that day, so it's excluded as an anchor. Not scoped by voyage number,
 * same reasoning as getPreviousEntry. */
export async function getPreviousSailingReport(
  companyId: string,
  vesselId: string,
  before?: { date: Date; createdAt: Date },
): Promise<{ date: Date; reportTimeLocal: string | null; dtgNextPortNm: number | null } | null> {
  return prisma.voyageLog.findFirst({
    where: {
      companyId,
      vesselId,
      reportType: { not: "IN_PORT" },
      deletedAt: null,
      ...(before ? { OR: [{ date: { lt: before.date } }, { date: before.date, createdAt: { lt: before.createdAt } }] } : {}),
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: { date: true, reportTimeLocal: true, dtgNextPortNm: true },
  });
}

/** Sum of every entry's own portStayHrs strictly after the given Arrival
 * (exclusive) up to and including `upto` — the crew's self-reported daily
 * figures, for comparing against the time-based Total Time in Port so a
 * report page can flag when they disagree (typo'd Port Stay hrs, a wrong
 * Report Time, a missed day). Purely a QA cross-check; never used to derive
 * the authoritative total itself. Not scoped by voyage number, same
 * reasoning as getLastArrival above. */
export async function sumPortStayHrsSinceArrival(
  companyId: string,
  vesselId: string,
  arrival: { date: Date; createdAt: Date },
  upto: { date: Date; createdAt: Date },
): Promise<number> {
  const rows = await prisma.voyageLog.findMany({
    where: {
      companyId,
      vesselId,
      deletedAt: null,
      AND: [
        { OR: [{ date: { gt: arrival.date } }, { date: arrival.date, createdAt: { gt: arrival.createdAt } }] },
        { OR: [{ date: { lt: upto.date } }, { date: upto.date, createdAt: { lte: upto.createdAt } }] },
      ],
    },
    select: { portStayHrs: true },
  });
  return rows.reduce((sum, r) => sum + (r.portStayHrs ?? 0), 0);
}

/** Same running totals as getVoyageCumulativeTotals, but with no "before"
 * cutoff — the sum of every entry saved so far for this voyage. Used to
 * live-preview the Voyage-to-Date column in the Add-entry form (where the
 * new entry doesn't exist yet, so "everything so far" IS the base to add
 * this entry's own values onto), the same way bunker Previous ROB is
 * pre-fetched for a live Consumed preview instead of only appearing after
 * save. */
export async function getVoyageCumulativeTotalsToDate(companyId: string, vesselId: string, voyageNo: string | null): Promise<VoyageCumulativeTotals> {
  const lastDeparture = await getLastDeparture(companyId, vesselId, voyageNo);
  const rows = await prisma.voyageLog.findMany({
    where: {
      companyId,
      vesselId,
      voyageNo,
      deletedAt: null,
      ...(lastDeparture
        ? { OR: [{ date: { gt: lastDeparture.date } }, { date: lastDeparture.date, createdAt: { gte: lastDeparture.createdAt } }] }
        : {}),
    },
    select: { distanceRunNm: true, steamingTimeHrs: true, engineDistanceNm: true, slipPct: true },
  });
  return sumCumulativeRows(rows);
}

export type EntryDiscrepancy = {
  kind: "port_stay" | "steaming_time";
  reportedHrs: number;
  computedHrs: number;
  diffHrs: number;
};

const DISCREPANCY_TOLERANCE_HRS = 1;

/** Flags entries whose manually-typed hours figure (Port Stay while
 * alongside, Steaming Time while underway) doesn't match the real elapsed
 * time implied by consecutive Report Times. Steaming Time mismatches often
 * aren't mistakes at all — crossing a time zone means the ship's clock
 * legitimately jumps or falls back an hour — but they're still worth
 * surfacing so the crew can confirm it was a zone change and not a typo'd
 * hour. Walks the vessel's FULL entry history in one continuous timeline —
 * not grouped or reset by voyage number — since this fleet's convention
 * increments the voyage number AT the Departure that ends a port stay, so
 * the "last Arrival" anchor and "previous report" comparison for that
 * Departure legitimately sit under the PREVIOUS voyage number. Resetting
 * on a voyage-number change would make both context that's needed for the
 * very next entry disappear right when the number rolls over. Keyed by
 * entry id for the table to look up per row. */
export async function getVoyageDiscrepancies(companyId: string, vesselId: string): Promise<Map<string, EntryDiscrepancy>> {
  const rows = await prisma.voyageLog.findMany({
    where: { companyId, vesselId, deletedAt: null },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      date: true,
      createdAt: true,
      reportTimeLocal: true,
      reportType: true,
      portStayHrs: true,
      steamingTimeHrs: true,
    },
  });

  const result = new Map<string, EntryDiscrepancy>();
  let lastArrival: { date: Date; reportTimeLocal: string | null } | null = null;
  let prevSailingReport: { date: Date; reportTimeLocal: string | null } | null = null;
  let portStaySumSinceArrival = 0;

  for (const r of rows) {
    if (r.reportType === "ARRIVAL") {
      lastArrival = { date: r.date, reportTimeLocal: r.reportTimeLocal };
      portStaySumSinceArrival = 0;
    }

    // Steaming Time — only meaningful for a report that has a genuine prior
    // sailing report to measure elapsed time against (Departure itself is
    // that starting point, not a comparison target for itself).
    if ((r.reportType === "NOON_AT_SEA" || r.reportType === "ARRIVAL") && prevSailingReport && r.steamingTimeHrs != null) {
      const computedHrs = (reportDateTimeMs(r.date, r.reportTimeLocal) - reportDateTimeMs(prevSailingReport.date, prevSailingReport.reportTimeLocal)) / 3_600_000;
      const diffHrs = Math.abs(computedHrs - r.steamingTimeHrs);
      if (diffHrs > DISCREPANCY_TOLERANCE_HRS) {
        result.set(r.id, { kind: "steaming_time", reportedHrs: r.steamingTimeHrs, computedHrs, diffHrs });
      }
    }
    if (r.reportType !== "IN_PORT") {
      prevSailingReport = { date: r.date, reportTimeLocal: r.reportTimeLocal };
    }

    // Port Stay — same elapsed-since-Arrival cross-check as the report page.
    if ((r.reportType === "IN_PORT" || r.reportType === "DEPARTURE") && lastArrival) {
      portStaySumSinceArrival += r.portStayHrs ?? 0;
      const computedHrs = (reportDateTimeMs(r.date, r.reportTimeLocal) - reportDateTimeMs(lastArrival.date, lastArrival.reportTimeLocal)) / 3_600_000;
      const diffHrs = Math.abs(computedHrs - portStaySumSinceArrival);
      if (diffHrs > DISCREPANCY_TOLERANCE_HRS) {
        result.set(r.id, { kind: "port_stay", reportedHrs: portStaySumSinceArrival, computedHrs, diffHrs });
      }
    }
  }

  return result;
}
