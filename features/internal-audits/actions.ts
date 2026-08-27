"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { getReferenceListValues } from "@/lib/reference-list";
import { rootCauseSubcategoryKey } from "@/lib/reference-registry";
import { allocateRefNo } from "@/lib/ref-sequence";
import type { InternalAuditStatus } from "@/lib/generated/prisma";
import {
  createInternalAuditSchema,
  addFindingSchema,
  findingRootCauseSchema,
} from "./schema";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

async function nextRefNo(companyId: string, vesselCode: string | null): Promise<string> {
  const year = new Date().getFullYear();
  return allocateRefNo(companyId, vesselCode ? `${vesselCode}-IA-${year}` : `IA-${year}`);
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

  let vesselCode: string | null = null;
  if (d.vesselId) {
    const vessel = await prisma.vessel.findFirst({
      where: { id: d.vesselId, companyId: user.companyId },
      select: { code: true },
    });
    if (!vessel) return fail("Vessel not found");
    vesselCode = vessel.code;
  }

  const status: InternalAuditStatus = formData.get("intent") === "draft" ? "DRAFT" : "OPEN";
  const audit = await prisma.internalAudit.create({
    data: {
      companyId: user.companyId,
      refNo: status === "OPEN" ? await nextRefNo(user.companyId, vesselCode) : null,
      vesselId: d.vesselId || null,
      scope: d.scope,
      standard: d.standard,
      auditorName: d.auditorName || null,
      auditBody: d.auditBody || null,
      auditDate: new Date(d.auditDate),
      summary: d.summary || null,
      status,
      createdBy: user.id,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "InternalAudit",
    entityId: audit.id,
    summary:
      status === "OPEN" ? `Recorded internal audit ${audit.refNo}` : `Saved draft — ${audit.scope}`,
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
  if (audit.status === "DRAFT") return fail("Report this draft first");
  if (audit.status === "CLOSED") return fail("Audit is closed");

  await prisma.internalAuditFinding.create({
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

export async function saveFindingRootCauseAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("iaudit:update");
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

  const finding = await prisma.internalAuditFinding.findFirst({
    where: { id: d.findingId, companyId: user.companyId, deletedAt: null },
  });
  if (!finding) return fail("Finding not found");

  // Root-cause sub-category must be a live option for the chosen category —
  // checked against the office-editable list ∪ the value already persisted, so
  // re-saving a root cause that holds a now-hidden sub-category never fails.
  const allowedSub = await getReferenceListValues(
    user.companyId,
    rootCauseSubcategoryKey(d.rootCauseCategory),
  );
  if (!allowedSub.has(d.rootCauseSubCategory) && d.rootCauseSubCategory !== finding.rootCauseSubCategory) {
    return fail("Select a valid sub-category for the chosen root cause");
  }

  await prisma.internalAuditFinding.update({
    where: { id: finding.id },
    data: {
      rootCauseCategory: d.rootCauseCategory,
      rootCauseSubCategory: d.rootCauseSubCategory,
      rootCause: d.rootCause || null,
    },
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
  });
  if (!audit) return fail("Audit not found");
  if (audit.status === "DRAFT") return fail("This audit is still a draft");
  if (audit.status === "CLOSED") return fail("Audit is already closed");

  const findings = await prisma.internalAuditFinding.findMany({
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
      : { entityType: "InternalAuditFinding", entityId: finding.id };
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

/** Submits a Draft — assigns its refNo (never done at draft-save time). */
export async function reportDraftInternalAuditAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("iaudit:create");
  const id = String(formData.get("auditId") ?? "");
  const audit = await prisma.internalAudit.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null, status: "DRAFT" },
  });
  if (!audit) return fail("Draft not found");
  if (audit.createdBy !== user.id) {
    return fail("Only the draft's creator can report this draft");
  }

  let vesselCode: string | null = null;
  if (audit.vesselId) {
    const vessel = await prisma.vessel.findFirst({
      where: { id: audit.vesselId, companyId: user.companyId },
      select: { code: true },
    });
    vesselCode = vessel?.code ?? null;
  }
  const refNo = await nextRefNo(user.companyId, vesselCode);

  await prisma.internalAudit.update({
    where: { id: audit.id },
    data: { status: "OPEN", refNo, updatedBy: user.id },
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "InternalAudit",
    entityId: audit.id,
    summary: `Recorded internal audit ${refNo}`,
  });

  revalidatePath("/internal-audits");
  revalidatePath(`/internal-audits/${audit.id}`);
  return OK;
}

/** Full edit of a Draft's own header fields — locked to DRAFT status only. */
export async function updateDraftInternalAuditAction(
  auditId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("iaudit:create");
  const audit = await prisma.internalAudit.findFirst({
    where: { id: auditId, companyId: user.companyId, deletedAt: null, status: "DRAFT" },
  });
  if (!audit) return fail("Draft not found");
  if (audit.createdBy !== user.id) {
    return fail("Only the draft's creator can edit this draft");
  }

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

  if (d.vesselId) {
    const vessel = await prisma.vessel.findFirst({
      where: { id: d.vesselId, companyId: user.companyId },
      select: { id: true },
    });
    if (!vessel) return fail("Vessel not found");
  }

  await prisma.internalAudit.update({
    where: { id: audit.id },
    data: {
      vesselId: d.vesselId || null,
      scope: d.scope,
      standard: d.standard,
      auditorName: d.auditorName || null,
      auditBody: d.auditBody || null,
      auditDate: new Date(d.auditDate),
      summary: d.summary || null,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "InternalAudit",
    entityId: audit.id,
    summary: `Updated draft — ${d.scope}`,
  });

  revalidatePath(`/internal-audits/${audit.id}`);
  return OK;
}

/** Deletes its own Draft — soft delete, DRAFT status only. */
export async function deleteDraftInternalAuditAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("iaudit:create");
  const id = String(formData.get("auditId") ?? "");
  const audit = await prisma.internalAudit.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null, status: "DRAFT" },
  });
  if (!audit) return fail("Draft not found");
  if (audit.createdBy !== user.id) {
    return fail("Only the draft's creator can delete this draft");
  }

  await prisma.internalAudit.update({
    where: { id: audit.id },
    data: { deletedAt: new Date(), deletedBy: user.id },
  });
  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "InternalAudit",
    entityId: audit.id,
    summary: `Deleted draft — ${audit.scope}`,
  });

  revalidatePath("/internal-audits");
  redirect("/internal-audits");
}
