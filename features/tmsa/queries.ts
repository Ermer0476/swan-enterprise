import "server-only";
import { prisma } from "@/lib/prisma";
import { elementOrderKey, type TmsaFindingStatusValue } from "./schema";

// A matrix row — the same shape whether it comes live from KPI answers
// (TmsaAssessment) or from an imported historical year (TmsaScore).
export type MatrixRow = {
  id: string;
  elementCode: string;
  title: string;
  sortOrder: number;
  s1Yes: number;
  s1Req: number;
  s2Yes: number;
  s2Req: number;
  s3Yes: number;
  s3Req: number;
  s4Yes: number;
  s4Req: number;
  reqTotal: number;
  rating: number;
  stageCleared: number;
};

/** Compute the live TMSA matrix from the current per-KPI Yes/No answers —
 * ported from Swan-GCC's lib/liveMatrix.ts. Titles/sort order come from the
 * most recently imported TmsaScore sheet (a live-only company has no
 * TmsaScore rows yet, so elements fall back to "Element <code>" + numeric
 * order). */
export async function getLiveMatrix(companyId: string): Promise<MatrixRow[]> {
  const [kpis, scoreMeta] = await Promise.all([
    prisma.tmsaAssessment.findMany({
      where: { companyId, deletedAt: null },
      select: { elementCode: true, stage: true, complianceStatus: true },
    }),
    prisma.tmsaScore.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { year: "desc" },
      select: { elementCode: true, title: true, sortOrder: true },
    }),
  ]);

  const meta = new Map<string, { title: string; sortOrder: number }>();
  for (const s of scoreMeta) {
    if (!meta.has(s.elementCode)) meta.set(s.elementCode, { title: s.title, sortOrder: s.sortOrder });
  }

  const acc = new Map<string, { y: number[]; r: number[] }>();
  for (const k of kpis) {
    if (!acc.has(k.elementCode)) acc.set(k.elementCode, { y: [0, 0, 0, 0], r: [0, 0, 0, 0] });
    const e = acc.get(k.elementCode)!;
    const si = k.stage >= 1 && k.stage <= 4 ? k.stage - 1 : 0;
    e.r[si]! += 1;
    if (k.complianceStatus !== "NO") e.y[si]! += 1;
  }

  const rows: MatrixRow[] = [...acc.entries()].map(([elementCode, { y, r }]) => {
    const reqTotal = r.reduce((a, b) => a + b, 0);
    const totalYes = y.reduce((a, b) => a + b, 0);
    const rating = reqTotal ? (totalYes / reqTotal) * 4 : 0;
    let stageCleared = 0;
    for (let s = 0; s < 4; s++) {
      if (r[s]! > 0 && y[s] === r[s]) stageCleared = s + 1;
      else break;
    }
    const m = meta.get(elementCode);
    return {
      id: `live-${elementCode}`,
      elementCode,
      title: m?.title ?? `Element ${elementCode}`,
      sortOrder: m?.sortOrder ?? elementOrderKey(elementCode),
      s1Yes: y[0]!, s1Req: r[0]!,
      s2Yes: y[1]!, s2Req: r[1]!,
      s3Yes: y[2]!, s3Req: r[2]!,
      s4Yes: y[3]!, s4Req: r[3]!,
      reqTotal,
      rating,
      stageCleared,
    };
  });

  rows.sort((a, b) => a.sortOrder - b.sortOrder);
  return rows;
}

export async function listScoreYears(companyId: string): Promise<number[]> {
  const grouped = await prisma.tmsaScore.groupBy({ by: ["year"], where: { companyId, deletedAt: null } });
  return grouped.map((g) => g.year).sort((a, b) => b - a);
}

export async function getMatrixForYear(companyId: string, year: number): Promise<MatrixRow[]> {
  return prisma.tmsaScore.findMany({
    where: { companyId, deletedAt: null, year },
    orderBy: { sortOrder: "asc" },
  });
}

export type FindingFilters = {
  status?: string;
  source?: string;
  elementCode?: string;
  q?: string;
};

export async function listFindings(companyId: string, filters: FindingFilters) {
  const q = (filters.q ?? "").trim();
  return prisma.tmsaFinding.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(filters.status ? { status: filters.status as TmsaFindingStatusValue } : {}),
      ...(filters.source ? { source: filters.source } : {}),
      ...(filters.elementCode ? { elementCode: filters.elementCode } : {}),
      ...(q
        ? {
            OR: [
              { observation: { contains: q, mode: "insensitive" } },
              { correctiveAction: { contains: q, mode: "insensitive" } },
              { kpiRef: { contains: q, mode: "insensitive" } },
              { source: { contains: q, mode: "insensitive" } },
              { responsible: { contains: q, mode: "insensitive" } },
              { code: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
  });
}

export async function listAllFindingsLight(companyId: string) {
  return prisma.tmsaFinding.findMany({
    where: { companyId, deletedAt: null },
    select: { status: true, target: true },
  });
}

export async function listFindingElementCodes(companyId: string): Promise<string[]> {
  const groups = await prisma.tmsaFinding.groupBy({
    by: ["elementCode"],
    where: { companyId, deletedAt: null },
  });
  return groups
    .map((g) => g.elementCode)
    .sort((a, b) => {
      const na = parseInt(a, 10);
      const nb = parseInt(b, 10);
      return na - nb || a.localeCompare(b);
    });
}

export async function getFinding(companyId: string, id: string) {
  return prisma.tmsaFinding.findFirst({ where: { id, companyId, deletedAt: null } });
}

export async function getElementKpis(companyId: string, elementCode: string) {
  return prisma.tmsaAssessment.findMany({
    where: { companyId, deletedAt: null, elementCode },
    orderBy: [{ stage: "asc" }, { questionNo: "asc" }],
  });
}

export async function getElementScore(companyId: string, elementCode: string) {
  return prisma.tmsaScore.findFirst({
    where: { companyId, deletedAt: null, elementCode },
    orderBy: { year: "desc" },
  });
}

export async function getElementFindingsLight(companyId: string, elementCode: string) {
  return prisma.tmsaFinding.findMany({
    where: { companyId, deletedAt: null, elementCode },
    select: { kpiRef: true, status: true },
  });
}

/** All elements (code + title) for the drill-down page's quick-jump
 * dropdown, newest score year first — falls back to nothing if no
 * TmsaScore rows exist yet (live-only company). */
export async function listElementJumpTargets(companyId: string) {
  const allScores = await prisma.tmsaScore.findMany({
    where: { companyId, deletedAt: null },
    orderBy: { year: "desc" },
    select: { elementCode: true, title: true, sortOrder: true },
  });
  const seen = new Set<string>();
  return allScores
    .filter((s) => (seen.has(s.elementCode) ? false : seen.add(s.elementCode)))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s) => ({ code: s.elementCode, title: s.title }));
}
