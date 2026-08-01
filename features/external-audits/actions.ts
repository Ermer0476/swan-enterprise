"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import {
  createExternalAuditSchema,
  addFindingSchema,
  findingRootCauseSchema,
} from "./schema";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

async function nextRefNo(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `EA-${year}-`;
  const count = await prisma.externalAudit.count({
    where: { companyId, refNo: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

export async function createExternalAuditAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("eaudit:create");
  const parsed = createExternalAuditSchema.safeParse({
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

  const audit = await prisma.externalAudit.create({
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
    entityType: "ExternalAudit",
    entityId: audit.id,
    summary: `Recorded external audit ${audit.refNo}`,
  });

  revalidatePath("/external-audits");
  redirect(`/external-audits/${audit.id}`);
}

export async function addFindingAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("eaudit:update");
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

  const audit = await prisma.externalAudit.findFirst({
    where: { id: d.auditId, companyId: user.companyId, deletedAt: null },
  });
  if (!audit) return fail("Audit not found");
  if (audit.status === "CLOSED") return fail("Audit is closed");

  await prisma.externalAuditFinding.create({
    data: {
      companyId: user.companyId,
      auditId: audit.id,
      category: d.category,
      reference: d.reference || null,
      description: d.description,
      createdBy: user.id,
    },
  });
  if (audit.status === "OPEN") {
    await prisma.externalAudit.update({
      where: { id: audit.id },
      data: { status: "IN_PROGRESS", updatedBy: user.id },
    });
  }

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "ExternalAuditFinding",
    entityId: audit.id,
    summary: `Added finding to ${audit.refNo}`,
  });

  revalidatePath(`/external-audits/${audit.id}`);
  return OK;
}

export async function saveFindingRootCauseAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("eaudit:update");
  const parsed = findingRootCauseSchema.safeParse({
    findingId: formData.get("findingId"),
    rootCauseCategory: formData.get("rootCauseCategory"),
    rootCauseSubCategory: formData.get("rootCauseSubCategory"),
    rootCause: formData.get("rootCause"),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const d = parsed.data;

  const finding = await prisma.externalAuditFinding.findFirst({
    where: { id: d.findingId, companyId: user.companyId, deletedAt: null },
  });
  if (!finding) return fail("Finding not found");

  await prisma.externalAuditFinding.update({
    where: { id: finding.id },
    data: {
      rootCauseCategory: d.rootCauseCategory,
      rootCauseSubCategory: d.rootCauseSubCategory,
      rootCause: d.rootCause || null,
    },
  });

  revalidatePath(`/external-audits/${finding.auditId}`);
  return OK;
}

export async function deleteFindingAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("eaudit:update");
  const id = String(formData.get("findingId") ?? "");
  const finding = await prisma.externalAuditFinding.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!finding) return fail("Finding not found");
  await prisma.externalAuditFinding.update({
    where: { id: finding.id },
    data: { deletedAt: new Date() },
  });
  revalidatePath(`/external-audits/${finding.auditId}`);
  return OK;
}

export async function closeExternalAuditAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("eaudit:close");
  const id = String(formData.get("auditId") ?? "");
  const audit = await prisma.externalAudit.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!audit) return fail("Audit not found");
  if (audit.status === "CLOSED") return fail("Audit is already closed");

  const findings = await prisma.externalAuditFinding.findMany({
    where: { auditId: audit.id, deletedAt: null },
    select: { id: true },
  });
  // A finding is only "closed" once it has at least one CAPA row and every
  // one of them is Closed — a finding with no recorded corrective action at
  // all is still pending, not just one with open CAPA rows. A finding raised
  // into an NCR moves its CAPA rows under entityType "NonConformity" (entityId
  // = the NCR's id, not the finding's) — the NCR becomes the single source of
  // truth (see createNcrAction).
  let unresolvedCount = 0;
  for (const finding of findings) {
    const linkedNcr = await prisma.nonConformity.findFirst({
      where: { companyId: user.companyId, sourceEntityId: finding.id, deletedAt: null },
      select: { id: true },
    });
    const capaWhere = linkedNcr
      ? { entityType: "NonConformity", entityId: linkedNcr.id }
      : { entityType: "ExternalAuditFinding", entityId: finding.id };
    const [total, open] = await Promise.all([
      prisma.capaAction.count({ where: { companyId: user.companyId, deletedAt: null, ...capaWhere } }),
      prisma.capaAction.count({ where: { companyId: user.companyId, deletedAt: null, status: { not: "CLOSED" }, ...capaWhere } }),
    ]);
    if (total === 0 || open > 0) unresolvedCount++;
  }
  if (unresolvedCount > 0) {
    return fail(
      `Close all CAPA items before closing the audit (${unresolvedCount} finding${unresolvedCount === 1 ? "" : "s"} still pending).`,
    );
  }

  await prisma.externalAudit.update({
    where: { id: audit.id },
    data: { status: "CLOSED", closedAt: new Date(), updatedBy: user.id },
  });
  await writeAudit({
    actor: user,
    action: "APPROVE",
    entityType: "ExternalAudit",
    entityId: audit.id,
    summary: `Closed external audit ${audit.refNo}`,
  });

  revalidatePath(`/external-audits/${audit.id}`);
  return OK;
}

export async function deleteExternalAuditAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("eaudit:delete");
  const id = String(formData.get("auditId") ?? "");
  const audit = await prisma.externalAudit.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!audit) return fail("Audit not found");
  await prisma.externalAudit.update({
    where: { id: audit.id },
    data: { deletedAt: new Date(), deletedBy: user.id },
  });
  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "ExternalAudit",
    entityId: audit.id,
    summary: `Deleted external audit ${audit.refNo}`,
  });
  revalidatePath("/external-audits");
  redirect("/external-audits");
}
