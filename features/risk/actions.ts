"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import {
  createDocumentSchema,
  addRevisionSchema,
  reviewSchema,
  hazardRowSchema,
  deleteHazardRowSchema,
  updateHazardRowSchema,
  executionSchema,
  revisionRequestSchema,
  decideRevisionRequestSchema,
  RISK_ENTITY_TYPE,
} from "./schema";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
function fail(error: string): ActionResult {
  return { ok: false, error };
}

async function nextRefNo(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `RA-${year}-`;
  const count = await prisma.riskAssessmentDocument.count({
    where: { companyId, refNo: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/** Copy every hazard row from one revision into another, resetting the
 * per-revision "new"/rating-change annotations — the new revision starts as
 * a faithful copy of what's in force, ready for the office to edit. */
async function copyForwardHazardRows(
  companyId: string,
  fromRevisionId: string,
  toRevisionId: string,
  actorId: string,
) {
  const rows = await prisma.riskHazardRow.findMany({
    where: { revisionId: fromRevisionId },
    orderBy: { rowNo: "asc" },
  });
  if (rows.length === 0) return;
  await prisma.riskHazardRow.createMany({
    data: rows.map((r) => ({
      companyId,
      revisionId: toRevisionId,
      rowNo: r.rowNo,
      phase: r.phase,
      consequence: r.consequence,
      causes: r.causes,
      severity: r.severity,
      likelihood: r.likelihood,
      existingControls: r.existingControls,
      additionalControls: r.additionalControls,
      resLikelihood: r.resLikelihood,
      responsible: r.responsible,
      isNew: false,
      ratingChangeNote: null,
      createdBy: actorId,
    })),
  });
}

/** Create a new controlled Risk Assessment document with its first (draft,
 * empty) revision. Hazard rows are added afterward via addHazardRowAction. */
export async function createDocumentAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("risk-doc:create");
  const parsed = createDocumentSchema.safeParse({
    title: formData.get("title"),
    category: formData.get("category"),
    description: formData.get("description"),
    vesselId: formData.get("vesselId"),
    applicableVesselType: formData.get("applicableVesselType"),
    reviewFrequencyMonths: formData.get("reviewFrequencyMonths"),
    smsProcedureRefs: formData.get("smsProcedureRefs"),
    riskMatrixRef: formData.get("riskMatrixRef"),
    checklistsRequired: formData.get("checklistsRequired"),
    approvalLevel: formData.get("approvalLevel"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const doc = await prisma.riskAssessmentDocument.create({
    data: {
      companyId: user.companyId,
      refNo: await nextRefNo(user.companyId),
      title: d.title,
      category: d.category,
      description: d.description || null,
      vesselId: d.vesselId || null,
      applicableVesselType: d.applicableVesselType || null,
      reviewFrequencyMonths: d.reviewFrequencyMonths,
      status: "DRAFT",
      ownerId: user.id,
      createdBy: user.id,
      updatedBy: user.id,
      revisions: {
        create: {
          companyId: user.companyId,
          revisionNo: 1,
          changeSummary: "Initial revision",
          smsProcedureRefs: d.smsProcedureRefs || null,
          riskMatrixRef: d.riskMatrixRef || null,
          checklistsRequired: d.checklistsRequired || null,
          approvalLevel: d.approvalLevel,
          status: "DRAFT",
          createdBy: user.id,
        },
      },
    },
  });

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: RISK_ENTITY_TYPE,
    entityId: doc.id,
    summary: `Created Risk Assessment ${doc.refNo} — ${doc.title}`,
  });

  revalidatePath("/risk/library");
  redirect(`/risk/${doc.id}`);
}

/** Add a new draft revision to an existing document (office-authored, or
 * spawned from an approved revision request). Copies forward the prior
 * revision's hazard rows so the office edits deltas, not a blank table. */
export async function addRevisionAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("risk-doc:update");
  const parsed = addRevisionSchema.safeParse({
    documentId: formData.get("documentId"),
    changeSummary: formData.get("changeSummary"),
    reviewTrigger: formData.get("reviewTrigger") || undefined,
    smsProcedureRefs: formData.get("smsProcedureRefs"),
    riskMatrixRef: formData.get("riskMatrixRef"),
    checklistsRequired: formData.get("checklistsRequired"),
    approvalLevel: formData.get("approvalLevel"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const doc = await prisma.riskAssessmentDocument.findFirst({
    where: { id: d.documentId, companyId: user.companyId, deletedAt: null },
    include: { revisions: { orderBy: { revisionNo: "desc" }, take: 1 } },
  });
  if (!doc) return fail("Risk Assessment not found");
  if (doc.status === "IN_REVIEW") return fail("A revision is already awaiting approval");
  const latest = doc.revisions[0];

  const nextNo = (latest?.revisionNo ?? 0) + 1;
  const revision = await prisma.riskAssessmentRevision.create({
    data: {
      companyId: user.companyId,
      documentId: doc.id,
      revisionNo: nextNo,
      changeSummary: d.changeSummary,
      reviewTrigger: d.reviewTrigger,
      smsProcedureRefs: d.smsProcedureRefs || null,
      riskMatrixRef: d.riskMatrixRef || null,
      checklistsRequired: d.checklistsRequired || null,
      approvalLevel: d.approvalLevel,
      status: "DRAFT",
      createdBy: user.id,
    },
  });
  if (latest) await copyForwardHazardRows(user.companyId, latest.id, revision.id, user.id);

  await prisma.riskAssessmentDocument.update({
    where: { id: doc.id },
    data: { status: "DRAFT", updatedBy: user.id },
  });

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "RiskAssessmentRevision",
    entityId: doc.id,
    summary: `Added revision ${nextNo} to ${doc.refNo}`,
  });

  revalidatePath(`/risk/${doc.id}`);
  return OK;
}

/** Add one hazard row to the latest draft revision. */
export async function addHazardRowAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("risk-doc:update");
  const parsed = hazardRowSchema.safeParse({
    revisionId: formData.get("revisionId"),
    phase: formData.get("phase"),
    consequence: formData.get("consequence"),
    causes: formData.get("causes"),
    severity: formData.get("severity"),
    likelihood: formData.get("likelihood"),
    existingControls: formData.get("existingControls"),
    additionalControls: formData.get("additionalControls"),
    resLikelihood: formData.get("resLikelihood") || undefined,
    responsible: formData.get("responsible"),
    isNew: formData.get("isNew"),
    ratingChangeNote: formData.get("ratingChangeNote"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const revision = await prisma.riskAssessmentRevision.findFirst({
    where: { id: d.revisionId, companyId: user.companyId },
    include: { document: { select: { id: true, companyId: true } } },
  });
  if (!revision || revision.document.companyId !== user.companyId) return fail("Revision not found");
  if (revision.status !== "DRAFT") return fail("Only draft revisions can be edited");

  const maxRow = await prisma.riskHazardRow.aggregate({
    where: { revisionId: revision.id },
    _max: { rowNo: true },
  });

  await prisma.riskHazardRow.create({
    data: {
      companyId: user.companyId,
      revisionId: revision.id,
      rowNo: (maxRow._max.rowNo ?? 0) + 1,
      phase: d.phase || null,
      consequence: d.consequence,
      causes: d.causes,
      severity: d.severity,
      likelihood: d.likelihood,
      existingControls: d.existingControls,
      additionalControls: d.additionalControls || null,
      resLikelihood: d.resLikelihood ?? null,
      responsible: d.responsible || null,
      isNew: !!d.isNew,
      ratingChangeNote: d.ratingChangeNote || null,
      createdBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "RiskHazardRow",
    entityId: revision.document.id,
    summary: `Added hazard row "${d.consequence}" to revision ${revision.revisionNo}`,
  });

  revalidatePath(`/risk/${revision.document.id}`);
  return OK;
}

/** Remove one hazard row from a draft revision. */
export async function deleteHazardRowAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("risk-doc:update");
  const parsed = deleteHazardRowSchema.safeParse({
    rowId: formData.get("rowId"),
    documentId: formData.get("documentId"),
  });
  if (!parsed.success) return fail("Invalid request");

  const row = await prisma.riskHazardRow.findFirst({
    where: { id: parsed.data.rowId, companyId: user.companyId },
    include: { revision: { select: { status: true, documentId: true } } },
  });
  if (!row || row.revision.documentId !== parsed.data.documentId) return fail("Hazard row not found");
  if (row.revision.status !== "DRAFT") return fail("Only draft revisions can be edited");

  await prisma.riskHazardRow.delete({ where: { id: row.id } });

  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "RiskHazardRow",
    entityId: parsed.data.documentId,
    summary: `Removed hazard row "${row.consequence}"`,
  });

  revalidatePath(`/risk/${parsed.data.documentId}`);
  return OK;
}

/** Edit one hazard row in place on a draft revision. */
export async function updateHazardRowAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("risk-doc:update");
  const parsed = updateHazardRowSchema.safeParse({
    rowId: formData.get("rowId"),
    phase: formData.get("phase"),
    consequence: formData.get("consequence"),
    causes: formData.get("causes"),
    severity: formData.get("severity"),
    likelihood: formData.get("likelihood"),
    existingControls: formData.get("existingControls"),
    additionalControls: formData.get("additionalControls"),
    resLikelihood: formData.get("resLikelihood") || undefined,
    responsible: formData.get("responsible"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const row = await prisma.riskHazardRow.findFirst({
    where: { id: d.rowId, companyId: user.companyId },
    include: { revision: { select: { status: true, documentId: true } } },
  });
  if (!row) return fail("Hazard row not found");
  if (row.revision.status !== "DRAFT") return fail("Only draft revisions can be edited");

  await prisma.riskHazardRow.update({
    where: { id: row.id },
    data: {
      phase: d.phase || null,
      consequence: d.consequence,
      causes: d.causes,
      severity: d.severity,
      likelihood: d.likelihood,
      existingControls: d.existingControls,
      additionalControls: d.additionalControls || null,
      resLikelihood: d.resLikelihood ?? null,
      responsible: d.responsible || null,
    },
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "RiskHazardRow",
    entityId: row.revision.documentId,
    summary: `Updated hazard row "${d.consequence}"`,
  });

  revalidatePath(`/risk/${row.revision.documentId}`);
  return OK;
}

/** Office finalizes the latest draft revision directly — the office author
 * already is the approving authority here, so there's no separate internal
 * review chain to route through. Moves DRAFT → APPROVED in one step and
 * makes this the in-force revision. */
export async function publishRevisionAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("risk-doc:approve");
  const parsed = reviewSchema.safeParse({ documentId: formData.get("documentId") });
  if (!parsed.success) return fail("Invalid request");

  const doc = await prisma.riskAssessmentDocument.findFirst({
    where: { id: parsed.data.documentId, companyId: user.companyId, deletedAt: null },
    include: {
      revisions: {
        orderBy: { revisionNo: "desc" },
        take: 1,
        include: { hazardRows: { select: { id: true } } },
      },
    },
  });
  if (!doc) return fail("Risk Assessment not found");
  if (doc.status !== "DRAFT") return fail("Only draft documents can be published");
  const latest = doc.revisions[0];
  if (!latest) return fail("No revision to publish");
  if (latest.hazardRows.length === 0) {
    return fail("Add at least one hazard row before publishing");
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.riskAssessmentRevision.update({
      where: { id: latest.id },
      data: { status: "APPROVED", approvedBy: user.id, approvedAt: now, effectiveDate: now },
    }),
    prisma.riskAssessmentDocument.update({
      where: { id: doc.id },
      data: {
        status: "APPROVED",
        currentRevisionId: latest.id,
        lastReviewDate: now,
        nextReviewDate: addMonths(now, doc.reviewFrequencyMonths),
        updatedBy: user.id,
      },
    }),
  ]);

  await writeAudit({
    actor: user,
    action: "APPROVE",
    entityType: RISK_ENTITY_TYPE,
    entityId: doc.id,
    summary: `Published ${doc.refNo} rev ${latest.revisionNo} — approved and in force`,
  });

  revalidatePath(`/risk/${doc.id}`);
  revalidatePath("/risk/library");
  return OK;
}

/** Archive a document. History is retained; it drops out of active-use lists. */
export async function archiveAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("risk-doc:archive");
  const parsed = reviewSchema.safeParse({ documentId: formData.get("documentId") });
  if (!parsed.success) return fail("Invalid request");

  const doc = await prisma.riskAssessmentDocument.findFirst({
    where: { id: parsed.data.documentId, companyId: user.companyId, deletedAt: null },
  });
  if (!doc) return fail("Risk Assessment not found");

  await prisma.riskAssessmentDocument.update({
    where: { id: doc.id },
    data: { status: "ARCHIVED", updatedBy: user.id },
  });

  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: RISK_ENTITY_TYPE,
    entityId: doc.id,
    summary: `Archived ${doc.refNo}`,
  });

  revalidatePath("/risk/library");
  revalidatePath(`/risk/${doc.id}`);
  return OK;
}

/** Record a crew execution ("permit") of an approved Risk Assessment against a specific job.
 * Pins to the document's current APPROVED revision — a frozen pointer, never re-resolved later. */
export async function recordExecutionAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("risk-doc:execute");
  const parsed = executionSchema.safeParse({
    documentId: formData.get("documentId"),
    vesselId: formData.get("vesselId"),
    jobName: formData.get("jobName"),
    conditionStatus: formData.get("conditionStatus"),
    changedConditionsNote: formData.get("changedConditionsNote") ?? "",
    temporaryHazards: formData.get("temporaryHazards"),
    temporaryControls: formData.get("temporaryControls"),
    toolboxAttendees: formData.get("toolboxAttendees"),
    toolboxSigned: formData.get("toolboxSigned"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const doc = await prisma.riskAssessmentDocument.findFirst({
    where: { id: d.documentId, companyId: user.companyId, deletedAt: null },
  });
  if (!doc) return fail("Risk Assessment not found");
  if (!doc.currentRevisionId) return fail("This Risk Assessment has no approved revision yet");
  if (doc.status === "ARCHIVED") return fail("This Risk Assessment is archived");

  const execution = await prisma.riskAssessmentExecution.create({
    data: {
      companyId: user.companyId,
      documentId: doc.id,
      revisionId: doc.currentRevisionId,
      vesselId: d.vesselId,
      jobName: d.jobName,
      conditionStatus: d.conditionStatus,
      changedConditionsNote: d.changedConditionsNote || null,
      temporaryHazards: d.temporaryHazards || null,
      temporaryControls: d.temporaryControls || null,
      toolboxAttendees: d.toolboxAttendees || null,
      toolboxSignedAt: d.toolboxSigned ? new Date() : null,
      performedById: user.id,
      createdBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "RiskAssessmentExecution",
    entityId: execution.id,
    summary: `Executed ${doc.refNo} for job "${d.jobName}"`,
  });

  revalidatePath(`/risk/${doc.id}`);
  revalidatePath("/risk");
  redirect(`/risk/${doc.id}`);
}

/** Crew-raised proposal to change a Risk Assessment. Never edits the master directly. */
export async function requestRevisionAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("risk-doc:request-revision");
  const parsed = revisionRequestSchema.safeParse({
    documentId: formData.get("documentId"),
    vesselId: formData.get("vesselId") ?? "",
    reason: formData.get("reason"),
    reviewTrigger: formData.get("reviewTrigger"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const doc = await prisma.riskAssessmentDocument.findFirst({
    where: { id: d.documentId, companyId: user.companyId, deletedAt: null },
  });
  if (!doc) return fail("Risk Assessment not found");

  const request = await prisma.riskAssessmentRevisionRequest.create({
    data: {
      companyId: user.companyId,
      documentId: doc.id,
      requestedById: user.id,
      vesselId: d.vesselId || user.vesselId || null,
      reason: d.reason,
      reviewTrigger: d.reviewTrigger,
      status: "PENDING",
    },
  });

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "RiskAssessmentRevisionRequest",
    entityId: request.id,
    summary: `Requested a revision to ${doc.refNo}`,
  });

  revalidatePath(`/risk/${doc.id}`);
  redirect(`/risk/${doc.id}`);
}

/** Office decides a revision request. Approval auto-creates a new draft
 * revision, copying forward the current approved hazard rows so the office
 * edits deltas rather than starting from a blank table. */
export async function decideRevisionRequestAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("risk-doc:approve");
  const parsed = decideRevisionRequestSchema.safeParse({
    requestId: formData.get("requestId"),
    decision: formData.get("decision"),
    decisionNote: formData.get("decisionNote") ?? "",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const request = await prisma.riskAssessmentRevisionRequest.findFirst({
    where: { id: d.requestId, companyId: user.companyId },
    include: {
      document: { include: { revisions: { orderBy: { revisionNo: "desc" }, take: 1 } } },
    },
  });
  if (!request) return fail("Revision request not found");
  if (request.status !== "PENDING") return fail("This request has already been decided");

  const doc = request.document;
  const latest = doc.revisions[0];

  if (d.decision === "APPROVED") {
    if (doc.status === "IN_REVIEW") {
      return fail("A revision is already awaiting approval — decide that first");
    }
    const nextNo = (latest?.revisionNo ?? 0) + 1;

    await prisma.riskAssessmentRevisionRequest.update({
      where: { id: request.id },
      data: {
        status: "APPROVED",
        decidedById: user.id,
        decidedAt: new Date(),
        decisionNote: d.decisionNote || null,
      },
    });

    const revision = await prisma.riskAssessmentRevision.create({
      data: {
        companyId: user.companyId,
        documentId: doc.id,
        revisionNo: nextNo,
        changeSummary: `Revision request approved: ${request.reason}`,
        reviewTrigger: request.reviewTrigger,
        smsProcedureRefs: latest?.smsProcedureRefs ?? null,
        riskMatrixRef: latest?.riskMatrixRef ?? null,
        checklistsRequired: latest?.checklistsRequired ?? null,
        approvalLevel: latest?.approvalLevel ?? "LOCAL",
        status: "DRAFT",
        createdBy: user.id,
      },
    });
    if (latest) await copyForwardHazardRows(user.companyId, latest.id, revision.id, user.id);

    await prisma.riskAssessmentDocument.update({
      where: { id: doc.id },
      data: { status: "DRAFT", updatedBy: user.id },
    });
  } else {
    await prisma.riskAssessmentRevisionRequest.update({
      where: { id: request.id },
      data: {
        status: "REJECTED",
        decidedById: user.id,
        decidedAt: new Date(),
        decisionNote: d.decisionNote || null,
      },
    });
  }

  await writeAudit({
    actor: user,
    action: d.decision === "APPROVED" ? "APPROVE" : "REJECT",
    entityType: "RiskAssessmentRevisionRequest",
    entityId: request.id,
    summary: `${d.decision === "APPROVED" ? "Approved" : "Rejected"} revision request for ${doc.refNo}`,
  });

  revalidatePath(`/risk/${doc.id}`);
  return OK;
}
