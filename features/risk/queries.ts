import "server-only";
import { prisma } from "@/lib/prisma";
import type { DocumentStatus } from "@/lib/generated/prisma";
import { computeRF, riskBand, type RiskBand } from "./schema";
import {
  RA_LEVELS,
  LIKELIHOOD_SCALE_LABELS,
  SEVERITY_SCALE_LABELS,
  type RaLevel,
  type RiskScaleLabels,
} from "./schema";
import { getReferenceList } from "@/lib/reference-list";
import type { ReferenceOption } from "@/lib/reference-registry";

/** Fill a level→label map for all five levels from a reference list, falling
 * back to the built-in scale label for any level the office has hidden, so the
 * 1–5 picker always renders every level. */
function toLevelMap(
  options: ReferenceOption[],
  fallback: Record<RaLevel, string>,
): Record<RaLevel, string> {
  const byValue = new Map(options.map((o) => [o.value, o.label]));
  return Object.fromEntries(
    RA_LEVELS.map((l) => [l, byValue.get(String(l)) ?? fallback[l]]),
  ) as Record<RaLevel, string>;
}

/** Office-editable likelihood/severity scale labels for the hazard-row
 * pickers and matrix rendering (registry fallback when a company has no
 * rows). Values 1–5 are fixed; only the labels vary. */
export async function getRiskScaleLabels(companyId: string): Promise<RiskScaleLabels> {
  const [likelihood, severity] = await Promise.all([
    getReferenceList(companyId, "risk-likelihood-label"),
    getReferenceList(companyId, "risk-severity-label"),
  ]);
  return {
    likelihood: toLevelMap(likelihood, LIKELIHOOD_SCALE_LABELS),
    severity: toLevelMap(severity, SEVERITY_SCALE_LABELS),
  };
}

export type RiskDocFilters = { search?: string; status?: DocumentStatus };

const hazardRowOrder = { rowNo: "asc" as const };

// Vessel-added rows (vesselId set) carry their vessel's name along so
// callers can label "added by <vessel>" without a separate lookup.
const hazardRowInclude = {
  orderBy: hazardRowOrder,
  include: { vessel: { select: { name: true } } },
} as const;

/** Highest residual-risk band across a revision's hazard rows — per RC-012
 * policy, overall risk = the worst row after controls, never a flat average. */
export function overallRiskBand(
  rows: { severity: number; resLikelihood: number | null; likelihood: number }[],
): RiskBand | null {
  if (rows.length === 0) return null;
  let worst = 0;
  for (const r of rows) {
    const rf = computeRF(r.severity, r.resLikelihood ?? r.likelihood);
    if (rf > worst) worst = rf;
  }
  return riskBand(worst);
}

export type ExecutionFilters = { search?: string; vesselId?: string };

/** All job executions across every Risk Assessment, newest first — the
 * shipboard-facing landing view ("what jobs have we done RAs for"). Paginated
 * (30/page) so the table stays fast once the fleet has built up months of
 * executions instead of loading everything at once. */
export async function listAllExecutions(
  companyId: string,
  filters: ExecutionFilters = {},
  page = 1,
  pageSize = 30,
) {
  const where = {
    companyId,
    ...(filters.vesselId ? { vesselId: filters.vesselId } : {}),
    ...(filters.search
      ? {
          OR: [
            { jobName: { contains: filters.search } },
            { document: { refNo: { contains: filters.search } } },
            { document: { title: { contains: filters.search } } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.riskAssessmentExecution.findMany({
      where,
      include: {
        vessel: { select: { name: true } },
        document: { select: { id: true, refNo: true, title: true } },
        revision: { select: { revisionNo: true } },
      },
      orderBy: { executedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.riskAssessmentExecution.count({ where }),
  ]);

  return { rows, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Office-facing KPIs for the Job Executions landing page. */
export async function executionKpis(companyId: string) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [totalThisMonth, changedCount, vessels] = await Promise.all([
    prisma.riskAssessmentExecution.count({
      where: { companyId, executedAt: { gte: startOfMonth } },
    }),
    prisma.riskAssessmentExecution.count({
      where: { companyId, conditionStatus: "CHANGED" },
    }),
    prisma.riskAssessmentExecution.findMany({
      where: { companyId },
      distinct: ["vesselId"],
      select: { vesselId: true },
    }),
  ]);

  return { totalThisMonth, changedCount, activeVessels: vessels.length };
}

/** List Risk Assessment documents for a company, newest first. */
export async function listRiskDocuments(companyId: string, filters: RiskDocFilters = {}) {
  return prisma.riskAssessmentDocument.findMany({
    where: {
      companyId,
      deletedAt: null,
      status: filters.status,
      ...(filters.search
        ? {
            OR: [
              { refNo: { contains: filters.search } },
              { title: { contains: filters.search } },
              { category: { contains: filters.search } },
            ],
          }
        : {}),
    },
    include: {
      vessel: { select: { name: true } },
      currentRevision: {
        select: {
          revisionNo: true,
          effectiveDate: true,
          hazardRows: { select: { severity: true, likelihood: true, resLikelihood: true } },
        },
      },
      _count: { select: { executions: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
  });
}

/** Full document with revision history (+ hazard rows), executions and revision requests.
 * `shipboardVesselId` — pass the caller's vessel id (or null) when the caller
 * is SHIPBOARD to restrict to fleet-wide (vesselId null, per schema comment)
 * or this vessel's own document; omit entirely for OFFICE callers, who see
 * every document as before. */
export async function getRiskDocument(companyId: string, id: string, shipboardVesselId?: string | null) {
  return prisma.riskAssessmentDocument.findFirst({
    where: {
      id,
      companyId,
      deletedAt: null,
      ...(shipboardVesselId !== undefined
        ? { OR: [{ vesselId: null }, { vesselId: shipboardVesselId ?? "__no-vessel-assigned__" }] }
        : {}),
    },
    include: {
      vessel: { select: { name: true } },
      currentRevision: { include: { hazardRows: hazardRowInclude } },
      revisions: {
        orderBy: { revisionNo: "desc" },
        include: { hazardRows: hazardRowInclude },
      },
      executions: {
        orderBy: { executedAt: "desc" },
        take: 20,
        include: { vessel: { select: { name: true } }, revision: { select: { revisionNo: true } } },
      },
      revisionRequests: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function listVesselOptions(companyId: string) {
  return prisma.vessel.findMany({
    where: { companyId, deletedAt: null, status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/** id → fullName map for resolving plain-string actor ids (owner, reviewOwner,
 * performedBy, requestedBy, decidedBy) without a formal Prisma relation. */
export async function userNameMap(companyId: string): Promise<Record<string, string>> {
  const users = await prisma.user.findMany({
    where: { companyId, deletedAt: null },
    select: { id: true, fullName: true },
  });
  return Object.fromEntries(users.map((u) => [u.id, u.fullName]));
}

/** Dashboard KPI counters for the library header. */
export async function riskDashboardCounts(companyId: string) {
  const now = new Date();
  const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [total, active, archived, dueSoon, overdue, pendingRequests] = await Promise.all([
    prisma.riskAssessmentDocument.count({ where: { companyId, deletedAt: null } }),
    prisma.riskAssessmentDocument.count({ where: { companyId, deletedAt: null, status: "APPROVED" } }),
    prisma.riskAssessmentDocument.count({ where: { companyId, deletedAt: null, status: "ARCHIVED" } }),
    prisma.riskAssessmentDocument.count({
      where: { companyId, deletedAt: null, nextReviewDate: { gte: now, lte: soon } },
    }),
    prisma.riskAssessmentDocument.count({
      where: { companyId, deletedAt: null, nextReviewDate: { lt: now } },
    }),
    prisma.riskAssessmentRevisionRequest.count({
      where: { companyId, status: "PENDING" },
    }),
  ]);

  return { total, active, archived, dueSoon, overdue, pendingRequests };
}

/** Most frequently used RAs — derived from execution counts, never a stored counter. */
export async function mostUsedRiskDocuments(companyId: string, limit = 5) {
  const docs = await prisma.riskAssessmentDocument.findMany({
    where: { companyId, deletedAt: null },
    select: {
      id: true,
      refNo: true,
      title: true,
      executions: { select: { executedAt: true }, orderBy: { executedAt: "desc" }, take: 1 },
      _count: { select: { executions: true } },
    },
  });
  return docs
    .filter((d) => d._count.executions > 0)
    .sort((a, b) => b._count.executions - a._count.executions)
    .slice(0, limit)
    .map((d) => ({
      id: d.id,
      refNo: d.refNo,
      title: d.title,
      totalUses: d._count.executions,
      lastUsedAt: d.executions[0]?.executedAt ?? null,
    }));
}

/** RAs that have never been executed — candidates for review/retirement. */
export async function neverUsedRiskDocuments(companyId: string, limit = 10) {
  const docs = await prisma.riskAssessmentDocument.findMany({
    where: { companyId, deletedAt: null, executions: { none: {} } },
    select: { id: true, refNo: true, title: true, status: true, updatedAt: true },
    orderBy: { updatedAt: "asc" },
    take: limit,
  });
  return docs;
}
