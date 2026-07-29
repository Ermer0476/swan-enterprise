"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import {
  createInternalAuditSchema,
  addFindingSchema,
  updateFindingSchema,
} from "./schema";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

async function nextRefNo(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `IA-${year}-`;
  const count = await prisma.internalAudit.count({
    where: { companyId, refNo: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

export async function createInternalAuditAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("iaudit:create");
  const parsed = createInternalAuditSchema.safeParse({
    vesselId: formData.get("vesselId"),
    scope: formData.get("scope"),
    standard: formData.get("standard"),
    auditorName: formData.get("auditorName"),
    auditBody: formData.get("auditBody"),
    auditDate: formData.get("auditDate"),
    summary: formData.get("summary"),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const d = parsed.data;

  const audit = await prisma.internalAudit.create({
    data: {
      companyId: user.companyId,
      refNo: await nextRefNo(user.companyId),
      vesselId: d.vesselId || null,
      scope: d.scope,
      standard: d.standard,
      auditorName: d.auditorName || null,
      auditBody: d.auditBody || null,
      auditDate: new Date(d.auditDate),
      summary: d.summary || null,
      status: "OPEN",
      createdBy: user.id,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "InternalAudit",
    entityId: audit.id,
    summary: `Recorded internal audit ${audit.refNo}`,
  });

  revalidatePath("/internal-audits");
  redirect(`/internal-audits/${audit.id}`);
}

export async function addFindingAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("iaudit:update");
  const parsed = addFindingSchema.safeParse({
    auditId: formData.get("auditId"),
    category: formData.get("category"),
    reference: formData.get("reference"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const d = parsed.data;

  const audit = await prisma.internalAudit.findFirst({
    where: { id: d.auditId, companyId: user.companyId, deletedAt: null },
  });
  if (!audit) return fail("Audit not found");
  if (audit.status === "CLOSED") return fail("Audit is closed");

  await prisma.internalAuditFinding.create({
    data: {
      companyId: user.companyId,
      auditId: audit.id,
      category: d.category,
      reference: d.reference || null,
      description: d.description,
      status: "OPEN",
      createdBy: user.id,
    },
  });
  if (audit.status === "OPEN") {
    await prisma.internalAudit.update({
      where: { id: audit.id },
      data: { status: "IN_PROGRESS", updatedBy: user.id },
    });
  }

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "InternalAuditFinding",
    entityId: audit.id,
    summary: `Added finding to ${audit.refNo}`,
  });

  revalidatePath(`/internal-audits/${audit.id}`);
  return OK;
}

export async function updateFindingAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("iaudit:update");
  const parsed = updateFindingSchema.safeParse({
    findingId: formData.get("findingId"),
    correctiveAction: formData.get("correctiveAction"),
    status: formData.get("status"),
  });
  if (!parsed.success) return fail("Invalid input");
  const d = parsed.data;

  const finding = await prisma.internalAuditFinding.findFirst({
    where: { id: d.findingId, companyId: user.companyId, deletedAt: null },
  });
  if (!finding) return fail("Finding not found");

  await prisma.internalAuditFinding.update({
    where: { id: finding.id },
    data: { correctiveAction: d.correctiveAction || null, status: d.status },
  });

  revalidatePath(`/internal-audits/${finding.auditId}`);
  return OK;
}

export async function deleteFindingAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("iaudit:update");
  const id = String(formData.get("findingId") ?? "");
  const finding = await prisma.internalAuditFinding.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!finding) return fail("Finding not found");
  await prisma.internalAuditFinding.update({
    where: { id: finding.id },
    data: { deletedAt: new Date() },
  });
  revalidatePath(`/internal-audits/${finding.auditId}`);
  return OK;
}

export async function closeInternalAuditAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("iaudit:close");
  const id = String(formData.get("auditId") ?? "");
  const audit = await prisma.internalAudit.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
    include: { findings: { where: { deletedAt: null, status: "OPEN" } } },
  });
  if (!audit) return fail("Audit not found");
  if (audit.status === "CLOSED") return fail("Audit is already closed");
  if (audit.findings.length > 0) {
    return fail("Close all findings before closing the audit");
  }

  await prisma.internalAudit.update({
    where: { id: audit.id },
    data: { status: "CLOSED", closedAt: new Date(), updatedBy: user.id },
  });
  await writeAudit({
    actor: user,
    action: "APPROVE",
    entityType: "InternalAudit",
    entityId: audit.id,
    summary: `Closed internal audit ${audit.refNo}`,
  });

  revalidatePath(`/internal-audits/${audit.id}`);
  return OK;
}

export async function deleteInternalAuditAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("iaudit:delete");
  const id = String(formData.get("auditId") ?? "");
  const audit = await prisma.internalAudit.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!audit) return fail("Audit not found");
  await prisma.internalAudit.update({
    where: { id: audit.id },
    data: { deletedAt: new Date(), deletedBy: user.id },
  });
  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "InternalAudit",
    entityId: audit.id,
    summary: `Deleted internal audit ${audit.refNo}`,
  });
  revalidatePath("/internal-audits");
  redirect("/internal-audits");
}
