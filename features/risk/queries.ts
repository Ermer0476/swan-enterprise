import "server-only";
import { prisma } from "@/lib/prisma";
import type { DocumentStatus } from "@/lib/generated/prisma";
import { computeRF, riskBand, type RiskBand } from "./schema";

export type RiskDocFilters = { search?: string; status?: DocumentStatus };

const hazardRowOrder = { rowNo: "asc" as const };

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

/** All job executions across every Risk Assessment, newest first — the
 * shipboard-facing landing view ("what jobs have we done RAs for"). */
export async function listAllExecutions(companyId: string, filters: { search?: string } = {}) {
  return prisma.riskAssessmentExecution.findMany({
    where: {
      companyId,
      ...(filters.search
        ? {
            OR: [
              { jobName: { contains: filters.search } },
              { document: { refNo: { contains: filters.search } } },
              { document: { title: { contains: filters.search } } },
            ],
          }
        : {}),
    },
    include: {
      vessel: { select: { name: true } },
      document: { select: { id: true, refNo: true, title: true } },
      revision: { select: { revisionNo: true } },
    },
    orderBy: { executedAt: "desc" },
    take: 200,
  });
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

/** Full document with revision history (+ hazard rows), executions and revision requests. */
export async function getRiskDocument(companyId: string, id: string) {
  return prisma.riskAssessmentDocument.findFirst({
    where: { id, companyId, deletedAt: null },
    include: {
      vessel: { select: { name: true } },
      currentRevision: { include: { hazardRows: { orderBy: hazardRowOrder } } },
      revisions: {
        orderBy: { revisionNo: "desc" },
        include: { hazardRows: { orderBy: hazardRowOrder } },
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
