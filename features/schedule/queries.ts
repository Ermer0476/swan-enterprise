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

export async function listScheduleItems(companyId: string, kind: ScheduleItemKind) {
  return prisma.scheduleItem.findMany({
    where: { companyId, kind, active: true, deletedAt: null },
    orderBy: { sortOrder: "asc" },
  });
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
  const items = await listScheduleItems(companyId, kind);
  const itemIds = items.map((i) => i.id);

  const byItem = new Map<string, { id: string; date: Date }[]>();
  if (itemIds.length > 0) {
    if (kind === "DRILL") {
      const rows = await prisma.emergencyDrill.findMany({
        where: { companyId, vesselId, scheduleItemId: { in: itemIds }, deletedAt: null },
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
