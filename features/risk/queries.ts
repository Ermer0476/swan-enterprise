import "server-only";
import { prisma } from "@/lib/prisma";
import type { DocumentStatus } from "@/lib/generated/prisma";
import { computeRF, riskBand, type RiskBand } from "./schema";

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
        include: {
          vessel: { select: { name: true } },
          revision: { select: { revisionNo: true } },
          hazardSelections: {
            include: {
              hazardRow: {
                select: {
                  id: true,
                  rowNo: true,
                  consequence: true,
                  causes: true,
                  existingControls: true,
                  additionalControls: true,
                  responsible: true,
                  severity: true,
                  likelihood: true,
                  resLikelihood: true,
                },
              },
            },
          },
          addedControls: { orderBy: { createdAt: "asc" } },
        },
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

export type VesselFeedbackItem = {
  id: string;
  type: "REVISION_REQUEST" | "EXECUTION_CONTROL" | "VESSEL_HAZARD_ROW";
  documentId: string;
  refNo: string;
  title: string;
  vesselName: string | null;
  itemSummary: string;
  date: Date;
  status: string; // revision request's own PENDING/APPROVED/REJECTED, or "Reviewed"/"Pending Review" for the other two
  disposition: string | null;
  /** EXECUTION_CONTROL only: the hazard this control was added against, the
   * vessel's own submitted text (retained, never overwritten), and office's
   * separately-drafted reworded version — the text actually meant to go
   * into the master template once disposition is ADDED_TO_TEMPLATE. */
  hazardConsequence: string | null;
  controlText: string | null;
  officeWording: string | null;
};

/** Unifies the three surfaces a vessel can feed RA feedback through —
 * revision requests, execution-added controls, and vessel-authored hazard
 * rows — into one consistent shape for the office-facing Vessel Feedback
 * screen, all decided with the same RaFeedbackDisposition vocabulary.
 * Returns every record (not just pending), newest first, so office can see
 * history alongside what's still outstanding. */
export async function listVesselFeedback(companyId: string): Promise<VesselFeedbackItem[]> {
  const [requests, controls, vesselRows] = await Promise.all([
    prisma.riskAssessmentRevisionRequest.findMany({
      where: { companyId },
      include: {
        document: { select: { id: true, refNo: true, title: true } },
        vessel: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.raExecutionControl.findMany({
      where: { companyId },
      include: {
        execution: {
          select: {
            documentId: true,
            document: { select: { refNo: true, title: true } },
            vessel: { select: { name: true } },
          },
        },
        hazardRow: { select: { consequence: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.riskHazardRow.findMany({
      where: { companyId, vesselId: { not: null } },
      include: {
        revision: { select: { documentId: true, document: { select: { refNo: true, title: true } } } },
        vessel: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const fromRequests: VesselFeedbackItem[] = requests.map((r) => ({
    id: r.id,
    type: "REVISION_REQUEST",
    documentId: r.document.id,
    refNo: r.document.refNo,
    title: r.document.title,
    vesselName: r.vessel?.name ?? null,
    itemSummary: r.reason,
    date: r.createdAt,
    status: r.status,
    disposition: r.disposition,
    hazardConsequence: null,
    controlText: null,
    officeWording: null,
  }));

  const fromControls: VesselFeedbackItem[] = controls.map((c) => ({
    id: c.id,
    type: "EXECUTION_CONTROL",
    documentId: c.execution.documentId,
    refNo: c.execution.document.refNo,
    title: c.execution.document.title,
    vesselName: c.execution.vessel.name,
    itemSummary: `${c.hazardRow.consequence}: ${c.controlText}`,
    date: c.createdAt,
    status: c.officeReviewedAt ? "REVIEWED" : "PENDING",
    disposition: c.disposition,
    hazardConsequence: c.hazardRow.consequence,
    controlText: c.controlText,
    officeWording: c.officeWording,
  }));

  const fromVesselRows: VesselFeedbackItem[] = vesselRows.map((row) => ({
    id: row.id,
    type: "VESSEL_HAZARD_ROW",
    documentId: row.revision.documentId,
    refNo: row.revision.document.refNo,
    title: row.revision.document.title,
    vesselName: row.vessel?.name ?? null,
    itemSummary: row.consequence,
    date: row.createdAt,
    status: row.officeReviewedAt ? "REVIEWED" : "PENDING",
    disposition: row.disposition,
    hazardConsequence: null,
    controlText: null,
    officeWording: null,
  }));

  return [...fromRequests, ...fromControls, ...fromVesselRows].sort(
    (a, b) => b.date.getTime() - a.date.getTime(),
  );
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
