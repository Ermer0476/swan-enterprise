"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { allocateRefNo } from "@/lib/ref-sequence";
import {
  createFlagInspectionSchema,
  addFindingSchema,
  findingRootCauseSchema,
} from "./schema";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

async function nextRefNo(companyId: string, vesselCode: string | null): Promise<string> {
  const year = new Date().getFullYear();
  return allocateRefNo(companyId, vesselCode ? `${vesselCode}-FI-${year}` : `FI-${year}`);
}

export async function createFlagInspectionAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("flaginsp:create");
  const parsed = createFlagInspectionSchema.safeParse({
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

  const audit = await prisma.flagInspection.create({
    data: {
      companyId: user.companyId,
      refNo: await nextRefNo(user.companyId, vesselCode),
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
    entityType: "FlagInspection",
    entityId: audit.id,
    summary: `Recorded flag inspection ${audit.refNo}`,
  });

  revalidatePath("/flag-inspections");
  redirect(`/flag-inspections/${audit.id}`);
}

export async function addFindingAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("flaginsp:update");
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

  const audit = await prisma.flagInspection.findFirst({
    where: { id: d.auditId, companyId: user.companyId, deletedAt: null },
  });
  if (!audit) return fail("Inspection not found");
  if (audit.status === "CLOSED") return fail("Inspection is closed");

  await prisma.flagInspectionFinding.create({
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
    await prisma.flagInspection.update({
      where: { id: audit.id },
      data: { status: "IN_PROGRESS", updatedBy: user.id },
    });
  }

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "FlagInspectionFinding",
    entityId: audit.id,
    summary: `Added finding to ${audit.refNo}`,
  });

  revalidatePath(`/flag-inspections/${audit.id}`);
  return OK;
}

export async function saveFindingRootCauseAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("flaginsp:update");
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

  const finding = await prisma.flagInspectionFinding.findFirst({
    where: { id: d.findingId, companyId: user.companyId, deletedAt: null },
  });
  if (!finding) return fail("Finding not found");

  await prisma.flagInspectionFinding.update({
    where: { id: finding.id },
    data: {
      rootCauseCategory: d.rootCauseCategory,
      rootCauseSubCategory: d.rootCauseSubCategory,
      rootCause: d.rootCause || null,
    },
  });

  revalidatePath(`/flag-inspections/${finding.auditId}`);
  return OK;
}

export async function deleteFindingAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("flaginsp:update");
  const id = String(formData.get("findingId") ?? "");
  const finding = await prisma.flagInspectionFinding.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!finding) return fail("Finding not found");
  await prisma.flagInspectionFinding.update({
    where: { id: finding.id },
    data: { deletedAt: new Date() },
  });
  revalidatePath(`/flag-inspections/${finding.auditId}`);
  return OK;
}

export async function closeFlagInspectionAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("flaginsp:close");
  const id = String(formData.get("auditId") ?? "");
  const audit = await prisma.flagInspection.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!audit) return fail("Inspection not found");
  if (audit.status === "CLOSED") return fail("Inspection is already closed");

  const findings = await prisma.flagInspectionFinding.findMany({
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
      : { entityType: "FlagInspectionFinding", entityId: finding.id };
    const [total, open] = await Promise.all([
      prisma.capaAction.count({ where: { companyId: user.companyId, deletedAt: null, ...capaWhere } }),
      prisma.capaAction.count({ where: { companyId: user.companyId, deletedAt: null, status: { not: "CLOSED" }, ...capaWhere } }),
    ]);
    if (total === 0 || open > 0) unresolvedCount++;
  }
  if (unresolvedCount > 0) {
    return fail(
      `Close all CAPA items before closing the inspection (${unresolvedCount} finding${unresolvedCount === 1 ? "" : "s"} still pending).`,
    );
  }

  await prisma.flagInspection.update({
    where: { id: audit.id },
    data: { status: "CLOSED", closedAt: new Date(), updatedBy: user.id },
  });
  await writeAudit({
    actor: user,
    action: "APPROVE",
    entityType: "FlagInspection",
    entityId: audit.id,
    summary: `Closed flag inspection ${audit.refNo}`,
  });

  revalidatePath(`/flag-inspections/${audit.id}`);
  return OK;
}

export async function deleteFlagInspectionAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("flaginsp:delete");
  const id = String(formData.get("auditId") ?? "");
  const audit = await prisma.flagInspection.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!audit) return fail("Inspection not found");
  await prisma.flagInspection.update({
    where: { id: audit.id },
    data: { deletedAt: new Date(), deletedBy: user.id },
  });
  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "FlagInspection",
    entityId: audit.id,
    summary: `Deleted flag inspection ${audit.refNo}`,
  });
  revalidatePath("/flag-inspections");
  redirect("/flag-inspections");
}
