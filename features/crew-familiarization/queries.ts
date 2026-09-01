import "server-only";
import { prisma } from "@/lib/prisma";

export type LsaFfeChecklistRow = {
  id: string;
  category: "LSA" | "FFE";
  itemNo: number;
  name: string;
  completedDate: Date | null;
  // Suggested week (1-8) from the catalog — a pacing guide only, not
  // enforced; every item can be marked done any week within the cycle.
  suggestedWeek: number;
  // Which week of the induction cycle the item was *actually* covered in,
  // derived from completedDate — null until covered.
  actualWeek: number | null;
  // Where this item stands relative to today, for the matrix's
  // green/red highlighting: "current" (its suggested week is this week —
  // do it now), "overdue" (its week has passed, still not covered), or
  // "upcoming" (its week hasn't arrived yet). "done" once covered.
  dueStatus: "done" | "current" | "overdue" | "upcoming";
};

export async function listCrewFamiliarizations(
  companyId: string,
  filters: { vesselId?: string; search?: string } = {},
) {
  return prisma.crewFamiliarization.findMany({
    where: {
      companyId,
      deletedAt: null,
      vesselId: filters.vesselId,
      ...(filters.search
        ? {
            OR: [
              { refNo: { contains: filters.search, mode: "insensitive" } },
              { attendees: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      vessel: { select: { name: true } },
      _count: { select: { records: true } },
    },
    orderBy: { cycleStartDate: "desc" },
  });
}

export async function getCrewFamiliarization(companyId: string, id: string) {
  return prisma.crewFamiliarization.findFirst({
    where: { id, companyId, deletedAt: null },
    include: { vessel: { select: { name: true } } },
  });
}

const TOTAL_LSA_FFE_ITEMS = 55; // 29 LSA + 26 FFE, fixed catalog size

export type LsaFfeSessionItem = {
  id: string;
  category: "LSA" | "FFE";
  itemNo: number;
  name: string;
  completedDate: Date;
};

/** The LSA/FFE items covered in ONE familiarization session (record) — for the
 * read-only record detail + printable report. Each record is a single session,
 * like an Emergency Drill record. */
export async function getFamiliarizationSessionItems(
  companyId: string,
  crewFamiliarizationId: string,
): Promise<LsaFfeSessionItem[]> {
  const records = await prisma.crewFamiliarizationRecord.findMany({
    where: { companyId, crewFamiliarizationId },
    orderBy: [{ lsaFfeItem: { category: "asc" } }, { lsaFfeItem: { itemNo: "asc" } }],
    select: {
      completedDate: true,
      lsaFfeItem: { select: { id: true, category: true, itemNo: true, name: true } },
    },
  });
  return records.map((r) => ({
    id: r.lsaFfeItem.id,
    category: r.lsaFfeItem.category,
    itemNo: r.lsaFfeItem.itemNo,
    name: r.lsaFfeItem.name,
    completedDate: r.completedDate,
  }));
}

/** Per-item LSA/FFE coverage for a vessel, aggregated across ALL its
 * familiarization sessions (records) — each item shows the latest date it was
 * covered. Drives the vessel matrix: covered items show their date (green),
 * still-outstanding items show the scheduled-week marker (red). */
export async function getVesselLsaFfeCoverage(
  companyId: string,
  vesselId: string,
): Promise<LsaFfeChecklistRow[]> {
  const [items, records] = await Promise.all([
    prisma.lsaFfeItem.findMany({
      where: { companyId, active: true },
      orderBy: [{ category: "asc" }, { itemNo: "asc" }],
      select: { id: true, category: true, itemNo: true, name: true, suggestedWeek: true },
    }),
    prisma.crewFamiliarizationRecord.findMany({
      where: { companyId, crewFamiliarization: { vesselId, deletedAt: null } },
      select: { lsaFfeItemId: true, completedDate: true },
    }),
  ]);

  // The most recent date each item was familiarized on this vessel.
  const latest = new Map<string, Date>();
  for (const r of records) {
    const cur = latest.get(r.lsaFfeItemId);
    if (!cur || r.completedDate > cur) latest.set(r.lsaFfeItemId, r.completedDate);
  }

  return items.map((item) => {
    const completedDate = latest.get(item.id) ?? null;
    return {
      id: item.id,
      category: item.category,
      itemNo: item.itemNo,
      name: item.name,
      completedDate,
      suggestedWeek: item.suggestedWeek,
      actualWeek: null,
      // Covered → done (shows the date); still outstanding → overdue (needs doing).
      dueStatus: completedDate ? "done" : "overdue",
    };
  });
}

export type LsaFfeCatalogItem = {
  id: string;
  category: "LSA" | "FFE";
  itemNo: number;
  name: string;
  suggestedWeek: number;
};

/** The plain LSA/FFE item catalog (no induction) — for the "start a new
 * familiarization" form, which creates the induction only on first log. */
export async function listLsaFfeCatalog(companyId: string): Promise<LsaFfeCatalogItem[]> {
  const items = await prisma.lsaFfeItem.findMany({
    where: { companyId, active: true },
    orderBy: [{ category: "asc" }, { itemNo: "asc" }],
    select: { id: true, category: true, itemNo: true, name: true, suggestedWeek: true },
  });
  return items;
}

export { TOTAL_LSA_FFE_ITEMS };
