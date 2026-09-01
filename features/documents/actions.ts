"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { allocateRefNo } from "@/lib/ref-sequence";
import type { ControlledDocStatus } from "@/lib/generated/prisma";
import { createDocumentSchema, DOCUMENT_STATUSES } from "./schema";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

function nextStatus(current: ControlledDocStatus): ControlledDocStatus | null {
  const i = DOCUMENT_STATUSES.indexOf(current);
  return (DOCUMENT_STATUSES[i + 1] as ControlledDocStatus | undefined) ?? null;
}

async function nextDocNumber(companyId: string, vesselCode: string | null): Promise<string> {
  const year = new Date().getFullYear();
  return allocateRefNo(companyId, vesselCode ? `${vesselCode}-DOC-${year}` : `DOC-${year}`);
}

export async function createDocumentAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("doc:create");
  const parsed = createDocumentSchema.safeParse({
    title: formData.get("title"),
    vesselId: formData.get("vesselId"),
    category: formData.get("category"),
    version: formData.get("version"),
    issueDate: formData.get("issueDate"),
    reviewDate: formData.get("reviewDate"),
    owner: formData.get("owner"),
    description: formData.get("description"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  let vesselCode: string | null = null;
  if (d.vesselId) {
    const vessel = await prisma.vessel.findFirst({
      where: { id: d.vesselId, companyId: user.companyId },
      select: { code: true },
    });
    if (!vessel) return fail("Vessel not found");
    vesselCode = vessel.code;
  }

  const doc = await prisma.controlledDocument.create({
    data: {
      companyId: user.companyId,
      docNumber: await nextDocNumber(user.companyId, vesselCode),
      title: d.title,
      vesselId: d.vesselId || null,
      category: d.category,
      version: d.version || null,
      issueDate: new Date(d.issueDate),
      reviewDate: d.reviewDate ? new Date(d.reviewDate) : null,
      owner: d.owner || null,
      description: d.description || null,
      status: "DRAFT",
      createdBy: user.id,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "ControlledDocument",
    entityId: doc.id,
    summary: `Added document ${doc.docNumber} — ${doc.title}`,
  });

  revalidatePath("/documents");
  redirect(`/documents/${doc.id}`);
}

export async function advanceDocumentAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("doc:update");
  const id = String(formData.get("docId") ?? "");
  const doc = await prisma.controlledDocument.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!doc) return fail("Document not found");

  const next = nextStatus(doc.status);
  if (!next) return fail("Document is already superseded");

  await prisma.controlledDocument.update({
    where: { id: doc.id },
    data: { status: next, updatedBy: user.id },
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "ControlledDocument",
    entityId: doc.id,
    summary: `${doc.docNumber} advanced to ${next}`,
  });

  revalidatePath(`/documents/${doc.id}`);
  return OK;
}

export async function deleteDocumentAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("doc:delete");
  const id = String(formData.get("docId") ?? "");
  const doc = await prisma.controlledDocument.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!doc) return fail("Document not found");

  await prisma.controlledDocument.update({
    where: { id: doc.id },
    data: { deletedAt: new Date(), deletedBy: user.id },
  });

  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "ControlledDocument",
    entityId: doc.id,
    summary: `Deleted document ${doc.docNumber}`,
  });

  revalidatePath("/documents");
  redirect("/documents");
}
