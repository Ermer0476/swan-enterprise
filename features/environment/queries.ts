import "server-only";
import { prisma } from "@/lib/prisma";
import { garbageTotals, sewageTotalDischarged, type GarbageCategoryValue } from "./schema";

export type EnvironmentRecordRow = Awaited<ReturnType<typeof listEnvironmentRecordsForVessel>>[number];

export async function listEnvironmentRecordsForVessel(companyId: string, vesselId: string, year?: number) {
  return prisma.environmentRecord.findMany({
    where: { companyId, vesselId, deletedAt: null, ...(year && { year }) },
    include: { garbageEntries: true },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });
}

export async function getEnvironmentRecord(companyId: string, recordId: string) {
  return prisma.environmentRecord.findFirst({
    where: { id: recordId, companyId, deletedAt: null },
    include: { vessel: { select: { id: true, name: true, code: true } }, garbageEntries: true },
  });
}

/** One row per vessel with an environment record — last record's period, for
 * the fleet list page's at-a-glance column. Mirrors listFleetLastEntries in
 * features/vessel-tracker/queries.ts. Vessels with zero records yet still
 * come back (with lastEntry: null) so every vessel stays reachable from the
 * fleet page.
 *
 * Every ACTIVE vessel is always included, plus any non-active vessel
 * (LAID_UP/DRYDOCK/SOLD) that already has environment records logged — once a
 * vessel goes inactive its past records must stay visible and reviewable,
 * not disappear from the list. Vessels that were never active-with-records
 * (most of the fleet's SOLD history) stay out to keep the list from
 * ballooning. orderBy status relies on the enum's declared order
 * (ACTIVE, LAID_UP, DRYDOCK, SOLD in schema.prisma) so active vessels sort
 * before inactive ones.
 *
 * `vesselId` — pass the caller's own vessel id when the caller is SHIPBOARD
 * to restrict the "fleet" list down to just that one vessel's row; omit for
 * OFFICE callers, who see every vessel. */
export async function listFleetLastEnvironmentEntries(companyId: string, vesselId?: string) {
  const recorded = await prisma.environmentRecord.findMany({
    where: { companyId, deletedAt: null, ...(vesselId ? { vesselId } : {}) },
    distinct: ["vesselId"],
    select: { vesselId: true },
  });

  const vessels = await prisma.vessel.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(vesselId ? { id: vesselId } : {}),
      OR: [{ status: "ACTIVE" }, { id: { in: recorded.map((r) => r.vesselId) } }],
    },
    select: { id: true, name: true, code: true, status: true },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });

  const lastEntries = await prisma.environmentRecord.findMany({
    where: { companyId, deletedAt: null, vesselId: { in: vessels.map((v) => v.id) } },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    distinct: ["vesselId"],
    select: { vesselId: true, year: true, month: true },
  });
  const byVessel = new Map(lastEntries.map((e) => [e.vesselId, e]));

  return vessels.map((v) => ({ vessel: v, lastEntry: byVessel.get(v.id) ?? null }));
}

export type EnvironmentMonthlyGarbage = { month: number; category: GarbageCategoryValue; totalCbm: number };

/** One row per month per category (only categories with any figures logged
 * that month, since garbageTotals only reflects entries actually written),
 * for the KPI dashboard's per-category chart. KPI dashboards for this module
 * are scoped to one calendar year at a time — a monthly-granularity record
 * only ever has up to 12 rows/year, so a Year-only filter (no
 * month/quarter breakdown) is the natural view, unlike Vessel Tracker's
 * daily-report KPI page. */
export async function getEnvironmentMonthlyGarbage(companyId: string, vesselId: string, year: number): Promise<EnvironmentMonthlyGarbage[]> {
  const records = await prisma.environmentRecord.findMany({
    where: { companyId, vesselId, year, deletedAt: null },
    include: { garbageEntries: true },
    orderBy: { month: "asc" },
  });
  return records.flatMap((r) => garbageTotals(r.garbageEntries).map((g) => ({ month: r.month, category: g.category, totalCbm: g.totalCbm })));
}

export type EnvironmentGarbageByMethod = {
  category: GarbageCategoryValue;
  overboardToSeaCbm: number;
  incineratedCbm: number;
  dischargeAshoreCbm: number;
};

/** One row per category, summed across the whole year, split by disposal
 * method (Overboard to Sea / Incinerated / Discharge Ashore) — for the KPI
 * dashboard's "how much per category finished at sea vs incinerated vs
 * ashore" breakdown, alongside the per-month category totals. */
export async function getEnvironmentGarbageByDisposalMethod(companyId: string, vesselId: string, year: number): Promise<EnvironmentGarbageByMethod[]> {
  const records = await prisma.environmentRecord.findMany({
    where: { companyId, vesselId, year, deletedAt: null },
    include: { garbageEntries: true },
  });
  const totals = new Map<GarbageCategoryValue, EnvironmentGarbageByMethod>();
  for (const record of records) {
    for (const entry of record.garbageEntries) {
      const existing = totals.get(entry.category) ?? { category: entry.category, overboardToSeaCbm: 0, incineratedCbm: 0, dischargeAshoreCbm: 0 };
      existing.overboardToSeaCbm += entry.overboardToSeaCbm ?? 0;
      existing.incineratedCbm += entry.incineratedCbm ?? 0;
      existing.dischargeAshoreCbm += entry.dischargeAshoreCbm ?? 0;
      totals.set(entry.category, existing);
    }
  }
  return Array.from(totals.values());
}

export type EnvironmentMonthlyDischarge = {
  month: number;
  ballastWaterQuantity: number | null;
  // Normalized to the metric's standard unit where a Unit picker exists
  // (falls back to the raw entered figure when no Unit Master match was
  // found yet) — charts need one consistent unit across months even if the
  // crew logged in different units month to month.
  sewageQuantity: number | null;
  greyWaterDischarged: number | null;
  refrigerantQuantityKg: number | null;
  refrigerantAdded: number | null;
  cargoLoaded: number | null;
  lubeOilAdded: number | null;
  bilgeGenerated: number | null;
  bilgeProcessed: number | null;
  sludgeGenerated: number | null;
  sludgeLandedAshore: number | null;
};

/** One row per month with the flat Oil/Water/Cargo/Refrigerant figures, for
 * the KPI dashboard's per-metric trend charts. */
export async function getEnvironmentMonthlyDischarge(companyId: string, vesselId: string, year: number): Promise<EnvironmentMonthlyDischarge[]> {
  const records = await prisma.environmentRecord.findMany({
    where: { companyId, vesselId, year, deletedAt: null },
    orderBy: { month: "asc" },
  });
  return records.map((r) => ({
    month: r.month,
    ballastWaterQuantity: r.ballastWaterQuantity,
    sewageQuantity:
      r.sewageQuantityNormalized ??
      (r.sewageDischargedAtSea != null || r.sewageDischargedToFacility != null ? sewageTotalDischarged(r) : null),
    greyWaterDischarged: r.greyWaterDischarged,
    refrigerantQuantityKg: r.refrigerantQuantityKg,
    refrigerantAdded: r.refrigerantAdded,
    cargoLoaded: r.cargoLoadedNormalized ?? r.cargoLoaded,
    lubeOilAdded: r.lubeOilAdded,
    bilgeGenerated: r.bilgeGenerated,
    bilgeProcessed: r.bilgeProcessed,
    sludgeGenerated: r.sludgeGenerated,
    sludgeLandedAshore: r.sludgeLandedAshore,
  }));
}

/** Unit Master rows for one metric, ordered so the company's default unit
 * (isDefault) sorts first in a dropdown. Used both by the entry form's Unit
 * pickers and by the admin management page. */
export async function listUnitMasters(companyId: string, metric?: "SEWAGE" | "CARGO") {
  return prisma.unitMaster.findMany({
    where: { companyId, ...(metric ? { metric } : {}) },
    orderBy: [{ metric: "asc" }, { isDefault: "desc" }, { unit: "asc" }],
  });
}

