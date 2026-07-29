"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { requireUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import {
  startInstance,
  getActiveInstance,
  act as workflowAct,
} from "@/features/workflow/engine";
import {
  createDocumentSchema,
  addRevisionSchema,
  reviewSchema,
  SMS_ENTITY_TYPE,
} from "./schema";

export type ActionResult = { ok: boolean; error: string | null };

const OK: ActionResult = { ok: true, error: null };
function fail(error: string): ActionResult {
  return { ok: false, error };
}

/** Create a new controlled document with its first (draft) revision. */
export async function createDocumentAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("sms:create");
  const parsed = createDocumentSchema.safeParse({
    code: formData.get("code"),
    title: formData.get("title"),
    description: formData.get("description"),
    category: formData.get("category"),
    department: formData.get("department"),
    content: formData.get("content"),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const data = parsed.data;

  const dupe = await prisma.smsDocument.findFirst({
    where: { companyId: user.companyId, code: data.code, deletedAt: null },
    select: { id: true },
  });
  if (dupe) return fail(`Document code "${data.code}" already exists`);

  const doc = await prisma.smsDocument.create({
    data: {
      companyId: user.companyId,
      code: data.code,
      title: data.title,
      description: data.description || null,
      category: data.category,
      department: data.department,
      status: "DRAFT",
      ownerId: user.id,
      createdBy: user.id,
      updatedBy: user.id,
      revisions: {
        create: {
          companyId: user.companyId,
          revisionNo: 1,
          changeSummary: "Initial revision",
          content: data.content || null,
          status: "DRAFT",
          createdBy: user.id,
        },
      },
    },
  });

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "SmsDocument",
    entityId: doc.id,
    summary: `Created SMS document ${doc.code} — ${doc.title}`,
  });

  revalidatePath("/sms-manual");
  redirect(`/sms-manual/${doc.id}`);
}

/** Add a new draft revision to an existing document. */
export async function addRevisionAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("sms:update");
  const parsed = addRevisionSchema.safeParse({
    documentId: formData.get("documentId"),
    changeSummary: formData.get("changeSummary"),
    content: formData.get("content"),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { documentId, changeSummary, content } = parsed.data;

  const doc = await prisma.smsDocument.findFirst({
    where: { id: documentId, companyId: user.companyId, deletedAt: null },
    include: { revisions: { orderBy: { revisionNo: "desc" }, take: 1 } },
  });
  if (!doc) return fail("Document not found");
  if (doc.status === "IN_REVIEW") {
    return fail("A revision is already awaiting approval");
  }

  const nextNo = (doc.revisions[0]?.revisionNo ?? 0) + 1;
  await prisma.$transaction([
    prisma.smsRevision.create({
      data: {
        companyId: user.companyId,
        documentId: doc.id,
        revisionNo: nextNo,
        changeSummary,
        content: content || null,
        status: "DRAFT",
        createdBy: user.id,
      },
    }),
    prisma.smsDocument.update({
      where: { id: doc.id },
      data: { status: "DRAFT", updatedBy: user.id },
    }),
  ]);

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "SmsRevision",
    entityId: doc.id,
    summary: `Added revision ${nextNo} to ${doc.code}`,
  });

  revalidatePath(`/sms-manual/${doc.id}`);
  return OK;
}

/**
 * Submit the latest draft revision for approval. Starts a workflow instance
 * from the company's configured SmsDocument approval chain. Fails clearly when
 * no chain is configured, so approvals are always governed by an admin-defined
 * workflow rather than hardcoded logic.
 */
export async function submitAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("sms:submit");
  const parsed = reviewSchema.safeParse({
    documentId: formData.get("documentId"),
  });
  if (!parsed.success) return fail("Invalid request");

  const doc = await prisma.smsDocument.findFirst({
    where: { id: parsed.data.documentId, companyId: user.companyId, deletedAt: null },
    include: { revisions: { orderBy: { revisionNo: "desc" }, take: 1 } },
  });
  if (!doc) return fail("Document not found");
  if (doc.status !== "DRAFT") return fail("Only draft documents can be submitted");
  const latest = doc.revisions[0];
  if (!latest) return fail("No revision to submit");

  // Start the configurable approval chain before mutating the document, so a
  // missing configuration leaves the document untouched.
  const instanceId = await startInstance(user.companyId, SMS_ENTITY_TYPE, doc.id);
  if (!instanceId) {
    return fail(
      "No approval workflow is configured for SMS documents. Ask an administrator to set one up under Settings → Workflows.",
    );
  }

  await prisma.$transaction([
    prisma.smsDocument.update({
      where: { id: doc.id },
      data: { status: "IN_REVIEW", updatedBy: user.id },
    }),
    prisma.smsRevision.update({
      where: { id: latest.id },
      data: { status: "IN_REVIEW" },
    }),
  ]);

  await writeAudit({
    actor: user,
    action: "SUBMIT",
    entityType: SMS_ENTITY_TYPE,
    entityId: doc.id,
    summary: `Submitted ${doc.code} rev ${latest.revisionNo} for approval`,
  });

  revalidatePath(`/sms-manual/${doc.id}`);
  return OK;
}

/**
 * Record an approve/reject decision on the current workflow step. Authorization
 * is enforced by the engine against the current step's approver (role /
 * department / specific user) — not a blanket permission. When the engine
 * finalizes the instance, the document is updated accordingly.
 */
export async function decideAction(
  documentId: string,
  decision: "APPROVE" | "REJECT",
  comment: string,
): Promise<ActionResult> {
  const user = await requireUser();

  const doc = await prisma.smsDocument.findFirst({
    where: { id: documentId, companyId: user.companyId, deletedAt: null },
    include: { revisions: { orderBy: { revisionNo: "desc" }, take: 1 } },
  });
  if (!doc) return fail("Document not found");
  if (doc.status !== "IN_REVIEW") return fail("Document is not awaiting approval");
  const latest = doc.revisions[0];
  if (!latest) return fail("No revision under review");

  const instance = await getActiveInstance(user.companyId, SMS_ENTITY_TYPE, doc.id);
  if (!instance) return fail("No active approval workflow for this document");

  let result;
  try {
    result = await workflowAct(user, instance.id, decision, comment || null);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Workflow error";
    if (msg === "FORBIDDEN") {
      return fail("You are not the approver for the current step");
    }
    return fail("Could not record the decision");
  }

  if (result.status === "REJECTED") {
    await prisma.$transaction([
      prisma.smsRevision.update({
        where: { id: latest.id },
        data: { status: "DRAFT" },
      }),
      prisma.smsDocument.update({
        where: { id: doc.id },
        data: { status: "DRAFT", updatedBy: user.id },
      }),
    ]);
  } else if (result.status === "APPROVED") {
    const now = new Date();
    await prisma.$transaction([
      prisma.smsRevision.update({
        where: { id: latest.id },
        data: {
          status: "APPROVED",
          approvedBy: user.id,
          approvedAt: now,
          effectiveDate: now,
        },
      }),
      prisma.smsDocument.update({
        where: { id: doc.id },
        data: {
          status: "APPROVED",
          currentRevisionId: latest.id,
          updatedBy: user.id,
        },
      }),
    ]);
  }
  // IN_PROGRESS → document stays IN_REVIEW, advanced to the next step.

  await writeAudit({
    actor: user,
    action: decision === "APPROVE" ? "APPROVE" : "REJECT",
    entityType: SMS_ENTITY_TYPE,
    entityId: doc.id,
    summary: `${decision === "APPROVE" ? "Approved" : "Rejected"} ${doc.code} rev ${latest.revisionNo} (${result.status})`,
    metadata: { comment: comment || null, workflowInstanceId: instance.id },
  });

  revalidatePath(`/sms-manual/${doc.id}`);
  return OK;
}

/** Archive a document (soft state change; history is retained). */
export async function archiveAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("sms:delete");
  const parsed = reviewSchema.safeParse({
    documentId: formData.get("documentId"),
  });
  if (!parsed.success) return fail("Invalid request");

  const doc = await prisma.smsDocument.findFirst({
    where: { id: parsed.data.documentId, companyId: user.companyId, deletedAt: null },
  });
  if (!doc) return fail("Document not found");

  await prisma.smsDocument.update({
    where: { id: doc.id },
    data: { status: "ARCHIVED", updatedBy: user.id },
  });

  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "SmsDocument",
    entityId: doc.id,
    summary: `Archived ${doc.code}`,
  });

  revalidatePath("/sms-manual");
  revalidatePath(`/sms-manual/${doc.id}`);
  return OK;
}
