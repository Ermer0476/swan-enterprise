import "server-only";
import { prisma } from "@/lib/prisma";

export async function listVessels(companyId: string) {
  return prisma.vessel.findMany({
    where: { companyId, deletedAt: null },
    orderBy: { name: "asc" },
  });
}

export async function getVessel(companyId: string, id: string) {
  return prisma.vessel.findFirst({
    where: { id, companyId, deletedAt: null },
  });
}

export type YearCount = { year: number; count: number };

/** "Vessels under management" per year — a vessel counts for every year from
 * the year it joined the fleet (yearWithSwan) through the year it left
 * (archivedAt), or through this year if still active. Mirrors the Swan-GCC
 * fleet-history chart. */
export async function vesselHistoryByYear(
  companyId: string,
): Promise<{ history: YearCount[]; peakYear: number }> {
  const vessels = await prisma.vessel.findMany({
    where: { companyId, deletedAt: null, yearWithSwan: { not: null } },
    select: { yearWithSwan: true, archivedAt: true },
  });

  const nowYear = new Date().getFullYear();
  if (vessels.length === 0) return { history: [], peakYear: nowYear };

  const minYear = Math.min(...vessels.map((v) => v.yearWithSwan!));
  const history: YearCount[] = [];
  for (let y = minYear; y <= nowYear; y++) {
    const count = vessels.filter((v) => {
      if (v.yearWithSwan! > y) return false;
      const exit = v.archivedAt ? v.archivedAt.getUTCFullYear() : nowYear;
      return y <= exit;
    }).length;
    history.push({ year: y, count });
  }

  // The current year's bar should always agree with the live "Active
  // Vessels" count — some vessels have no yearWithSwan on file yet (so the
  // year-by-year estimate above misses them), and a vessel sold earlier
  // this same year would otherwise still be counted as "under management"
  // for part of it. Overriding this one bar keeps the two numbers in sync.
  const currentYearEntry = history[history.length - 1];
  if (currentYearEntry && currentYearEntry.year === nowYear) {
    currentYearEntry.count = await prisma.vessel.count({
      where: { companyId, deletedAt: null, status: { not: "SOLD" } },
    });
  }

  const peak = history.reduce((a, b) => (b.count > a.count ? b : a), history[0]!);

  return { history, peakYear: peak.year };
}
