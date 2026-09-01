import "server-only";
import { prisma } from "@/lib/prisma";
import type { ScheduleItemKind } from "@/lib/generated/prisma";

export type MatrixRow = {
  id: string;
  category: string | null;
  itemNo: string | null;
  name: string;
  smsReference: string | null;
  frequencyLabel: string | null;
  frequencyDays: number | null;
  lastDate: Date | null;
  nextDue: Date | null;
  // "none" covers both n/a-frequency items ("as required") and items with a
  // frequency that have simply never been done and aren't overdue-tracked
  // any differently from "red" — kept as a separate value only so the UI can
  // grey out true n/a items rather than flagging them red.
  status: "green" | "red" | "none";
  // index 0 = Jan .. 11 = Dec — every completion recorded that month (not
  // just the latest), each carrying its record id so the UI can link
  // straight to that specific drill/familiarization entry.
  monthEntries: { day: number; id: string }[][];
  notApplicable: boolean;
  naReason: string | null;
};

/**
 * `flag` selects a slice of the catalog:
 * - omitted → every item across every flag (the admin management view)
 * - `""` → only the fleet-wide fallback/default set
 * - a real flag name → only that flag's own set
 * Use `resolveEffectiveScheduleItems` instead when you have a specific
 * vessel and want "that vessel's own set, falling back to default".
 */
export async function listScheduleItems(companyId: string, kind: ScheduleItemKind, flag?: string) {
  return prisma.scheduleItem.findMany({
    where: { companyId, kind, active: true, deletedAt: null, ...(flag !== undefined ? { flag } : {}) },
    orderBy: [{ flag: "asc" }, { sortOrder: "asc" }],
  });
}

/** Every flag that currently has at least one active item of its own,
 * across both kinds — feeds the admin page's flag picker so it's obvious
 * which flags already have a custom set vs. which still fall back to
 * default. */
export async function listFlagsWithScheduleItems(companyId: string): Promise<string[]> {
  const rows = await prisma.scheduleItem.findMany({
    where: { companyId, active: true, deletedAt: null, flag: { not: "" } },
    select: { flag: true },
    distinct: ["flag"],
  });
  return rows.map((r) => r.flag).sort();
}

/** A vessel's own effective item set: its flag's dedicated set if one has
 * been configured, otherwise the fleet-wide default ("") set. This is the
 * function every drill/familiarization page should call instead of
 * `listScheduleItems` once a real vessel is in scope. */
export async function resolveEffectiveScheduleItems(
  companyId: string,
  kind: ScheduleItemKind,
  vesselFlag: string | null,
) {
  if (vesselFlag) {
    const flagItems = await listScheduleItems(companyId, kind, vesselFlag);
    if (flagItems.length > 0) return flagItems;
  }
  return listScheduleItems(companyId, kind, "");
}

/** Builds the compliance matrix for one vessel — Last/Next due (computed
 * from the most recent completion ever, not just within `year`) and a
 * Jan–Dec day-of-month grid scoped to `year`. Mirrors the SMS A-EMP-01 /
 * CK-047(b) monitoring sheet layout. */
export async function buildScheduleMatrix(
  companyId: string,
  vesselId: string,
  kind: ScheduleItemKind,
  year: number,
): Promise<MatrixRow[]> {
  const vessel = await prisma.vessel.findFirst({ where: { id: vesselId, companyId }, select: { flag: true } });
  const items = await resolveEffectiveScheduleItems(companyId, kind, vessel?.flag ?? null);
  const itemIds = items.map((i) => i.id);

  const byItem = new Map<string, { id: string; date: Date }[]>();
  if (itemIds.length > 0) {
    if (kind === "DRILL") {
      const rows = await prisma.emergencyDrill.findMany({
        // A Draft isn't a completed drill yet — exclude it so it doesn't
        // count toward this month's compliance until it's actually reported.
        where: { companyId, vesselId, scheduleItemId: { in: itemIds }, deletedAt: null, status: { not: "DRAFT" } },
        select: { id: true, scheduleItemId: true, drillDate: true },
      });
      for (const r of rows) {
        const arr = byItem.get(r.scheduleItemId) ?? [];
        arr.push({ id: r.id, date: r.drillDate });
        byItem.set(r.scheduleItemId, arr);
      }
    } else {
      const rows = await prisma.familiarizationRecord.findMany({
        where: { companyId, vesselId, scheduleItemId: { in: itemIds }, deletedAt: null },
        select: { id: true, scheduleItemId: true, completedDate: true },
      });
      for (const r of rows) {
        const arr = byItem.get(r.scheduleItemId) ?? [];
        arr.push({ id: r.id, date: r.completedDate });
        byItem.set(r.scheduleItemId, arr);
      }
    }
  }

  const today = new Date();

  const exceptions = itemIds.length
    ? await prisma.scheduleApplicability.findMany({
        where: { companyId, vesselId, scheduleItemId: { in: itemIds }, notApplicable: true },
        select: { scheduleItemId: true, reason: true },
      })
    : [];
  const naByItem = new Map(exceptions.map((e) => [e.scheduleItemId, e.reason]));

  return items.map((item) => {
    const entries = (byItem.get(item.id) ?? []).sort((a, b) => b.date.getTime() - a.date.getTime());
    const lastDate = entries[0]?.date ?? null;
    const nextDue =
      lastDate && item.frequencyDays
        ? new Date(lastDate.getTime() + item.frequencyDays * 86_400_000)
        : null;

    const notApplicable = naByItem.has(item.id);

    let status: MatrixRow["status"] = "none";
    if (item.frequencyDays && !notApplicable) {
      status = !lastDate || (nextDue && nextDue < today) ? "red" : "green";
    }

    const monthEntries: { day: number; id: string }[][] = Array.from({ length: 12 }, () => []);
    for (const e of entries) {
      if (e.date.getFullYear() === year) {
        monthEntries[e.date.getMonth()]!.push({ day: e.date.getDate(), id: e.id });
      }
    }
    for (const month of monthEntries) month.sort((a, b) => a.day - b.day);

    return {
      id: item.id,
      category: item.category,
      itemNo: item.itemNo,
      name: item.name,
      smsReference: item.smsReference,
      frequencyLabel: item.frequencyLabel,
      frequencyDays: item.frequencyDays,
      lastDate,
      nextDue,
      status,
      monthEntries,
      notApplicable,
      naReason: naByItem.get(item.id) ?? null,
    };
  });
}

export type DrillMonthlyComplianceRow = {
  vesselId: string;
  vesselName: string;
  missingItems: string[];
};

// A drill/familiarization item with frequencyDays this short only makes
// sense read as "required every calendar month" — anything longer (e.g.
// quarterly) is already covered by buildScheduleMatrix's ordinary
// last-date/next-due overdue tracking, not a per-month requirement.
export const MONTHLY_FREQUENCY_DAYS_MAX = 31;

/** Same per-vessel matrix as buildScheduleMatrix, but for every vessel at
 * once in a fixed handful of queries instead of one buildScheduleMatrix
 * call (2-3 queries) per vessel — the difference between ~3 queries and
 * ~50+ once the fleet is more than a couple vessels. Used by the fleet-wide
 * Vessel Health rollup and the monthly-compliance alert list below. */
export async function buildFleetDrillMatrix(companyId: string, year: number): Promise<Map<string, MatrixRow[]>> {
  const [vessels, flagsWithItems] = await Promise.all([
    prisma.vessel.findMany({
      where: { companyId, deletedAt: null, status: "ACTIVE" },
      select: { id: true, flag: true },
    }),
    listFlagsWithScheduleItems(companyId),
  ]);
  const flagsWithItemsSet = new Set(flagsWithItems);
  // Each vessel's EFFECTIVE flag key — its own flag if that flag has a
  // dedicated set, otherwise "" (the fallback set) — so vessels sharing an
  // effective set only need that set's items fetched once.
  const effectiveFlagOf = new Map<string, string>();
  for (const v of vessels) effectiveFlagOf.set(v.id, v.flag && flagsWithItemsSet.has(v.flag) ? v.flag : "");
  const distinctFlags = Array.from(new Set(effectiveFlagOf.values()));

  const itemsByFlag = new Map<string, Awaited<ReturnType<typeof listScheduleItems>>>();
  await Promise.all(
    distinctFlags.map(async (flag) => {
      itemsByFlag.set(flag, await listScheduleItems(companyId, "DRILL", flag));
    }),
  );

  const vesselIds = vessels.map((v) => v.id);
  const allItemIds = distinctFlags.flatMap((flag) => itemsByFlag.get(flag)!.map((i) => i.id));

  const [drillRows, exceptions] =
    vesselIds.length && allItemIds.length
      ? await Promise.all([
          prisma.emergencyDrill.findMany({
            where: { companyId, vesselId: { in: vesselIds }, scheduleItemId: { in: allItemIds }, deletedAt: null, status: { not: "DRAFT" } },
            select: { id: true, vesselId: true, scheduleItemId: true, drillDate: true },
          }),
          prisma.scheduleApplicability.findMany({
            where: { companyId, vesselId: { in: vesselIds }, scheduleItemId: { in: allItemIds }, notApplicable: true },
            select: { vesselId: true, scheduleItemId: true, reason: true },
          }),
        ])
      : [[], []];

  const byVesselItem = new Map<string, Map<string, { id: string; date: Date }[]>>();
  for (const r of drillRows) {
    const itemMap = byVesselItem.get(r.vesselId) ?? new Map();
    const arr = itemMap.get(r.scheduleItemId) ?? [];
    arr.push({ id: r.id, date: r.drillDate });
    itemMap.set(r.scheduleItemId, arr);
    byVesselItem.set(r.vesselId, itemMap);
  }
  const naByVesselItem = new Map<string, Map<string, string | null>>();
  for (const e of exceptions) {
    const itemMap = naByVesselItem.get(e.vesselId) ?? new Map();
    itemMap.set(e.scheduleItemId, e.reason);
    naByVesselItem.set(e.vesselId, itemMap);
  }

  const today = new Date();
  const result = new Map<string, MatrixRow[]>();
  for (const vesselId of vesselIds) {
    const items = itemsByFlag.get(effectiveFlagOf.get(vesselId) ?? "") ?? [];
    const itemMap: Map<string, { id: string; date: Date }[]> = byVesselItem.get(vesselId) ?? new Map();
    const naMap: Map<string, string | null> = naByVesselItem.get(vesselId) ?? new Map();
    result.set(
      vesselId,
      items.map((item) => {
        const entries = (itemMap.get(item.id) ?? []).sort((a, b) => b.date.getTime() - a.date.getTime());
        const lastDate = entries[0]?.date ?? null;
        const nextDue = lastDate && item.frequencyDays ? new Date(lastDate.getTime() + item.frequencyDays * 86_400_000) : null;
        const notApplicable = naMap.has(item.id);

        let status: MatrixRow["status"] = "none";
        if (item.frequencyDays && !notApplicable) {
          status = !lastDate || (nextDue && nextDue < today) ? "red" : "green";
        }

        const monthEntries: { day: number; id: string }[][] = Array.from({ length: 12 }, () => []);
        for (const e of entries) {
          if (e.date.getFullYear() === year) {
            monthEntries[e.date.getMonth()]!.push({ day: e.date.getDate(), id: e.id });
          }
        }
        for (const month of monthEntries) month.sort((a, b) => a.day - b.day);

        return {
          id: item.id,
          category: item.category,
          itemNo: item.itemNo,
          name: item.name,
          smsReference: item.smsReference,
          frequencyLabel: item.frequencyLabel,
          frequencyDays: item.frequencyDays,
          lastDate,
          nextDue,
          status,
          monthEntries,
          notApplicable,
          naReason: naMap.get(item.id) ?? null,
        };
      }),
    );
  }
  return result;
}

/** Fleet-wide "did every vessel do its monthly-required drill(s) this
 * calendar month" check — built on buildFleetDrillMatrix's single batched
 * pass rather than one buildScheduleMatrix call per vessel. */
export async function listDrillMonthlyCompliance(companyId: string): Promise<DrillMonthlyComplianceRow[]> {
  const vessels = await prisma.vessel.findMany({
    where: { companyId, deletedAt: null, status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const now = new Date();
  const month = now.getMonth();
  const matrixByVessel = await buildFleetDrillMatrix(companyId, now.getFullYear());

  return vessels.map((v) => {
    const matrix = matrixByVessel.get(v.id) ?? [];
    const missing = matrix.filter(
      (item) =>
        item.frequencyDays !== null &&
        item.frequencyDays <= MONTHLY_FREQUENCY_DAYS_MAX &&
        !item.notApplicable &&
        (item.monthEntries[month] ?? []).length === 0,
    );
    return { vesselId: v.id, vesselName: v.name, missingItems: missing.map((m) => m.name) };
  });
}

/** Vessels with at least one monthly-required drill not yet done this
 * month — the Dashboard alert-worthy subset. */
export function drillMonthlyAlerts(rows: DrillMonthlyComplianceRow[]): DrillMonthlyComplianceRow[] {
  return rows.filter((r) => r.missingItems.length > 0);
}
