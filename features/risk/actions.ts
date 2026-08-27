"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import mammoth from "mammoth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma";
import { requirePermission } from "@/lib/rbac";
import { requireUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { allocateRefNo } from "@/lib/ref-sequence";
import {
  createDocumentSchema,
  addRevisionSchema,
  reviewSchema,
  hazardRowSchema,
  bulkHazardRowDraftSchema,
  deleteHazardRowSchema,
  updateHazardRowSchema,
  executionSchema,
  revisionRequestSchema,
  decideRevisionRequestSchema,
  RISK_ENTITY_TYPE,
} from "./schema";
import { parseRaHazardTable, type ParsedHazardRowDraft, type ParsedRaMetadata } from "./document-parser";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
function fail(error: string): ActionResult {
  return { ok: false, error };
}

async function nextRefNo(companyId: string, vesselCode: string | null): Promise<string> {
  const year = new Date().getFullYear();
  return allocateRefNo(companyId, vesselCode ? `${vesselCode}-RA-${year}` : `RA-${year}`);
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/** Copy every hazard row from one revision into another, resetting the
 * per-revision "new"/rating-change annotations — the new revision starts as
 * a faithful copy of what's in force, ready for the office to edit. Vessel-
 * specific addenda (vesselId set) carry forward too — they haven't been
 * formally reviewed away, so a new revision shouldn't silently drop them. */
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
      vesselId: r.vesselId,
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

/** Create a new controlled Risk Assessment document with its first (draft)
 * revision. If a revised-RA document was uploaded and reviewed on the New
 * Risk Assessment form (see NewRiskAssessmentForm), its confirmed hazard
 * rows ride along in the same submit as a "rows" JSON field — otherwise the
 * revision starts empty and rows are added one at a time on the document
 * page, same as before. */
export async function createDocumentAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("risk-doc:create");
  const parsed = createDocumentSchema.safeParse({
    title: formData.get("title"),
    category: formData.get("category"),
    description: formData.get("description"),
    applicableVesselType: formData.get("applicableVesselType"),
    reviewFrequencyMonths: formData.get("reviewFrequencyMonths"),
    smsProcedureRefs: formData.get("smsProcedureRefs"),
    riskMatrixRef: formData.get("riskMatrixRef"),
    checklistsRequired: formData.get("checklistsRequired"),
    approvalLevel: formData.get("approvalLevel"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  let rows: z.infer<typeof bulkHazardRowDraftSchema>[] = [];
  const rawRows = formData.get("rows");
  if (typeof rawRows === "string" && rawRows.trim() && rawRows !== "[]") {
    let raw: unknown;
    try {
      raw = JSON.parse(rawRows);
    } catch {
      return fail("Invalid hazard row data");
    }
    const rowsParsed = z.array(bulkHazardRowDraftSchema).max(100).safeParse(raw);
    if (!rowsParsed.success) return fail(rowsParsed.error.issues[0]?.message ?? "Invalid hazard row data");
    rows = rowsParsed.data;
  }

  // Every Risk Assessment is fleet-wide now — vessel-scoped documents were
  // confusing shipboard users browsing the shared library (they'd see other
  // ships' RAs mixed in with no way to tell they didn't apply).
  const doc = await prisma.riskAssessmentDocument.create({
    data: {
      companyId: user.companyId,
      refNo: await nextRefNo(user.companyId, null),
      title: d.title,
      category: d.category,
      description: d.description || null,
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
          changeSummary: rows.length > 0 ? "Initial revision — imported from uploaded document" : "Initial revision",
          smsProcedureRefs: d.smsProcedureRefs || null,
          riskMatrixRef: d.riskMatrixRef || null,
          checklistsRequired: d.checklistsRequired || null,
          approvalLevel: d.approvalLevel,
          status: "DRAFT",
          createdBy: user.id,
          ...(rows.length > 0 && {
            hazardRows: {
              create: rows.map((r, i) => ({
                companyId: user.companyId,
                rowNo: i + 1,
                phase: r.phase,
                consequence: r.consequence,
                causes: r.causes,
                severity: r.severity,
                likelihood: r.likelihood,
                existingControls: r.existingControls,
                additionalControls: r.additionalControls,
                resLikelihood: r.resLikelihood,
                responsible: r.responsible,
                isNew: r.isNew,
                createdBy: user.id,
              })),
            },
          }),
        },
      },
    },
  });

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: RISK_ENTITY_TYPE,
    entityId: doc.id,
    summary:
      rows.length > 0
        ? `Created Risk Assessment ${doc.refNo} — ${doc.title} (${rows.length} hazard rows imported from uploaded document)`
        : `Created Risk Assessment ${doc.refNo} — ${doc.title}`,
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

  // revisionNo is read-then-write; @@unique([documentId, revisionNo]) is the
  // real guard against a concurrent add racing us to the same number. On that
  // rare P2002, re-derive the next number (the other insert is committed by
  // now, so this naturally advances) and retry.
  let nextNo = (latest?.revisionNo ?? 0) + 1;
  let revision;
  for (let attempt = 0; ; attempt++) {
    try {
      revision = await prisma.riskAssessmentRevision.create({
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
      break;
    } catch (err) {
      const isDuplicate = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
      if (!isDuplicate || attempt >= 5) throw err;
      const max = await prisma.riskAssessmentRevision.aggregate({
        where: { documentId: doc.id },
        _max: { revisionNo: true },
      });
      nextNo = (max._max.revisionNo ?? 0) + 1;
    }
  }
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

export type ParseRaDocumentResult = {
  ok: boolean;
  error: string | null;
  rows: ParsedHazardRowDraft[];
  metadata: ParsedRaMetadata;
};
const EMPTY_METADATA: ParsedRaMetadata = { title: null, smsProcedureRefs: null, riskMatrixRef: null, checklistsRequired: null };

/** Reads an uploaded revised-RA Word document and returns parsed hazard-row
 * drafts plus a best-effort read of the header metadata (title, SMS
 * procedure refs, risk matrix, checklists) — nothing is saved here. Used
 * both to import rows into an existing draft revision, and to prefill the
 * New Risk Assessment form so the office isn't retyping what's already in
 * the document. Everything returned stays on screen for review/correction
 * before anything is actually persisted, same pattern as the SIRE import. */
export async function parseRaDocumentAction(
  _prev: ParseRaDocumentResult,
  formData: FormData,
): Promise<ParseRaDocumentResult> {
  await requirePermission("risk-doc:update");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a file to upload", rows: [], metadata: EMPTY_METADATA };
  }
  const isDocx =
    file.name.toLowerCase().endsWith(".docx") ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (!isDocx) {
    return { ok: false, error: "Only Word (.docx) files are supported", rows: [], metadata: EMPTY_METADATA };
  }

  let text: string;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await mammoth.extractRawText({ buffer });
    text = result.value;
  } catch {
    return { ok: false, error: "Could not read this document — it may be corrupted", rows: [], metadata: EMPTY_METADATA };
  }

  const { rows, metadata } = parseRaHazardTable(text);
  if (rows.length === 0) {
    return {
      ok: false,
      error: "No hazard rows were recognized — check the document matches the revised RA table format",
      rows: [],
      metadata,
    };
  }
  return { ok: true, error: null, rows, metadata };
}

/** Replaces every master hazard row in a draft revision with the reviewer-
 * confirmed rows from an uploaded document — the office already reviewed
 * each one on screen before this runs. A vessel's own addenda (vesselId set)
 * are left untouched; this only ever touches the fleet-wide master table. */
export async function bulkReplaceHazardRowsAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("risk-doc:update");
  const revisionId = String(formData.get("revisionId") ?? "");
  if (!revisionId) return fail("Invalid request");

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("rows") ?? "[]"));
  } catch {
    return fail("Invalid import payload");
  }
  const parsed = z.array(bulkHazardRowDraftSchema).min(1).max(100).safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid import payload");
  const rows = parsed.data;

  const revision = await prisma.riskAssessmentRevision.findFirst({
    where: { id: revisionId, companyId: user.companyId },
    include: { document: { select: { id: true, companyId: true } } },
  });
  if (!revision || revision.document.companyId !== user.companyId) return fail("Revision not found");
  if (revision.status !== "DRAFT") return fail("Only draft revisions can be edited");

  await prisma.$transaction([
    prisma.riskHazardRow.deleteMany({ where: { revisionId: revision.id, vesselId: null } }),
    prisma.riskHazardRow.createMany({
      data: rows.map((r, i) => ({
        companyId: user.companyId,
        revisionId: revision.id,
        rowNo: i + 1,
        phase: r.phase,
        consequence: r.consequence,
        causes: r.causes,
        severity: r.severity,
        likelihood: r.likelihood,
        existingControls: r.existingControls,
        additionalControls: r.additionalControls,
        resLikelihood: r.resLikelihood,
        responsible: r.responsible,
        isNew: r.isNew,
        createdBy: user.id,
      })),
    }),
  ]);

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "RiskHazardRow",
    entityId: revision.document.id,
    summary: `Imported ${rows.length} hazard rows from an uploaded document into revision ${revision.revisionNo}`,
  });

  revalidatePath(`/risk/${revision.document.id}`);
  return OK;
}

/** Add one vessel-specific hazard row directly, no office review needed —
 * for when a ship feels the master RA is missing something specific to
 * their own situation. Attaches to the document's current in-force
 * revision, tagged with the adding vessel's id, so it's visible only to
 * that vessel (and to office, for oversight) — never to other vessels, and
 * never counted as part of the fleet-wide master hazard table. If something
 * should apply fleet-wide instead, that's what Request a Revision is for. */
export async function addVesselHazardRowAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("risk-doc:execute");
  if (!user.vesselId) return fail("Only a vessel account can add a vessel-specific hazard row");

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
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const revision = await prisma.riskAssessmentRevision.findFirst({
    where: { id: d.revisionId, companyId: user.companyId },
    include: { document: { select: { id: true, companyId: true, currentRevisionId: true } } },
  });
  if (!revision || revision.document.companyId !== user.companyId) return fail("Revision not found");
  if (revision.document.currentRevisionId !== revision.id) {
    return fail("Can only add to the current in-force revision");
  }

  const maxRow = await prisma.riskHazardRow.aggregate({
    where: { revisionId: revision.id },
    _max: { rowNo: true },
  });

  await prisma.riskHazardRow.create({
    data: {
      companyId: user.companyId,
      revisionId: revision.id,
      vesselId: user.vesselId,
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
      createdBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "RiskHazardRow",
    entityId: revision.document.id,
    summary: `Vessel added hazard row "${d.consequence}" (vessel-specific, not fleet-wide)`,
  });

  revalidatePath(`/risk/${revision.document.id}`);
  return OK;
}

/** Remove one hazard row. Master rows (vesselId null) require office
 * (risk-doc:update) on a still-DRAFT revision, same as before. A vessel's
 * own addendum row can be removed by that vessel any time (no DRAFT
 * requirement — it was never part of a formal revision to begin with), or
 * by office for oversight/cleanup. */
export async function deleteHazardRowAction(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
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

  const isOffice = user.permissions.has("risk-doc:update");
  if (row.vesselId) {
    const isOwningVessel = user.vesselId === row.vesselId && user.permissions.has("risk-doc:execute");
    if (!isOwningVessel && !isOffice) return fail("You don't have permission to remove this row");
  } else {
    if (!isOffice) return fail("You don't have permission to edit this Risk Assessment");
    if (row.revision.status !== "DRAFT") return fail("Only draft revisions can be edited");
  }

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

/** Edit one hazard row in place. Same split as delete: master rows need
 * office + DRAFT; a vessel's own addendum row is editable by that vessel
 * (or office) any time. */
export async function updateHazardRowAction(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
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

  const isOffice = user.permissions.has("risk-doc:update");
  if (row.vesselId) {
    const isOwningVessel = user.vesselId === row.vesselId && user.permissions.has("risk-doc:execute");
    if (!isOwningVessel && !isOffice) return fail("You don't have permission to edit this row");
  } else {
    if (!isOffice) return fail("You don't have permission to edit this Risk Assessment");
    if (row.revision.status !== "DRAFT") return fail("Only draft revisions can be edited");
  }

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

  const vessel = await prisma.vessel.findFirst({
    where: { id: d.vesselId, companyId: user.companyId },
  });
  if (!vessel) return fail("Vessel not found");

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

  // Optional FK — attach the vessel only if it actually resolves within this
  // company; a stale/foreign id is dropped to null rather than blowing up the
  // insert with a P2003 (crew-supplied and best-effort, not a hard requirement).
  const candidateVesselId = d.vesselId || user.vesselId || null;
  let vesselId: string | null = null;
  if (candidateVesselId) {
    const vessel = await prisma.vessel.findFirst({
      where: { id: candidateVesselId, companyId: user.companyId },
      select: { id: true },
    });
    vesselId = vessel?.id ?? null;
  }

  const request = await prisma.riskAssessmentRevisionRequest.create({
    data: {
      companyId: user.companyId,
      documentId: doc.id,
      requestedById: user.id,
      vesselId,
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
    let nextNo = (latest?.revisionNo ?? 0) + 1;

    await prisma.riskAssessmentRevisionRequest.update({
      where: { id: request.id },
      data: {
        status: "APPROVED",
        decidedById: user.id,
        decidedAt: new Date(),
        decisionNote: d.decisionNote || null,
      },
    });

    // revisionNo is read-then-write; @@unique([documentId, revisionNo]) guards
    // against a concurrent add. On a P2002, re-derive the next number and retry.
    let revision;
    for (let attempt = 0; ; attempt++) {
      try {
        revision = await prisma.riskAssessmentRevision.create({
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
        break;
      } catch (err) {
        const isDuplicate = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
        if (!isDuplicate || attempt >= 5) throw err;
        const max = await prisma.riskAssessmentRevision.aggregate({
          where: { documentId: doc.id },
          _max: { revisionNo: true },
        });
        nextNo = (max._max.revisionNo ?? 0) + 1;
      }
    }
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
