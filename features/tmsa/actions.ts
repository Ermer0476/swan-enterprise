"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { createFindingSchema, updateFindingSchema, kpiRefFor, TMSA_FINDING_STATUSES } from "./schema";

export type NewFindingState = { ok: boolean; error: string | null; message: string | null };
const findingFail = (error: string): NewFindingState => ({ ok: false, error, message: null });
const findingOk = (message: string): NewFindingState => ({ ok: true, error: null, message });

function revalidateTmsa() {
  revalidatePath("/tmsa", "layout");
}

// ── Element drill-down: KPI compliance + narrative ─────────────────────────

export async function updateKpiStatusAction(formData: FormData): Promise<void> {
  const user = await requirePermission("tmsa:update-kpi");
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !["YES", "NO"].includes(status)) return;

  const kpi = await prisma.tmsaAssessment.findFirst({ where: { id, companyId: user.companyId, deletedAt: null } });
  if (!kpi) return;

  await prisma.tmsaAssessment.update({
    where: { id },
    data: { complianceStatus: status as "YES" | "NO", updatedBy: user.id },
  });
  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "TmsaAssessment",
    entityId: id,
    summary: `KPI ${kpi.code} compliance set to ${status}`,
  });
  revalidateTmsa();
}

export async function updateKpiRemarksAction(formData: FormData): Promise<void> {
  const user = await requirePermission("tmsa:update-kpi");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const remarks = String(formData.get("remarks") ?? "").trim();

  const cur = await prisma.tmsaAssessment.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
    select: { code: true, responseState: true, revision: true },
  });
  if (!cur) return;

  const startingNewRevision = cur.responseState === "ON_OCIMF";
  await prisma.tmsaAssessment.update({
    where: { id },
    data: {
      remarks: remarks || null,
      responseState: "REVISED",
      revisedAt: new Date(),
      updatedBy: user.id,
      ...(startingNewRevision ? { revision: cur.revision + 1 } : {}),
    },
  });
  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "TmsaAssessment",
    entityId: id,
    summary: `Company Response revised for KPI ${cur.code}`,
  });
  revalidateTmsa();
}

export async function markUploadedToOcimfAction(id: string): Promise<void> {
  const user = await requirePermission("tmsa:update-kpi");
  if (!id) return;
  const kpi = await prisma.tmsaAssessment.findFirst({ where: { id, companyId: user.companyId, deletedAt: null } });
  if (!kpi) return;

  await prisma.tmsaAssessment.update({
    where: { id },
    data: { responseState: "ON_OCIMF", uploadedAt: new Date(), updatedBy: user.id },
  });
  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "TmsaAssessment",
    entityId: id,
    summary: `Marked KPI ${kpi.code} response as uploaded to OCIMF`,
  });
  revalidateTmsa();
}

// ── CAP tracker: findings ───────────────────────────────────────────────────

export async function createFindingAction(_prev: NewFindingState, formData: FormData): Promise<NewFindingState> {
  const user = await requirePermission("tmsa:manage-cap");
  const parsed = createFindingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return findingFail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const rawTarget = d.target ?? "";
  const target = /^\d{4}-\d{2}-\d{2}$/.test(rawTarget) ? rawTarget : "";
  const questionNo = d.questionNo ?? 0;
  const kpiRef = kpiRefFor(d.elementCode, d.stage, questionNo);

  const last = await prisma.tmsaFinding.findFirst({
    where: { companyId: user.companyId },
    orderBy: { seq: "desc" },
    select: { seq: true },
  });
  const seq = (last?.seq ?? 0) + 1;
  const code = `TMSA-${String(seq).padStart(3, "0")}`;

  const finding = await prisma.tmsaFinding.create({
    data: {
      companyId: user.companyId,
      code,
      seq,
      auditYear: d.auditYear,
      elementCode: d.elementCode,
      elementBase: parseInt(d.elementCode, 10) || 0,
      stageQ: d.stage ? `${d.stage}.0` : "",
      stage: d.stage,
      questionNo,
      kpiRef,
      source: d.source,
      observation: d.observation,
      correctiveAction: d.correctiveAction || "",
      status: d.status,
      responsible: d.responsible || "",
      target,
      createdBy: user.id,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "TmsaFinding",
    entityId: finding.id,
    summary: `Added TMSA audit observation ${code}${kpiRef ? ` (${kpiRef})` : ""}`,
  });
  revalidateTmsa();
  return findingOk(`Added ${code}${kpiRef ? ` (${kpiRef})` : ""}.`);
}

export async function deleteFindingAction(id: string): Promise<void> {
  const user = await requirePermission("tmsa:manage-cap");
  if (!id) return;
  const finding = await prisma.tmsaFinding.findFirst({ where: { id, companyId: user.companyId, deletedAt: null } });
  if (!finding) return;

  await prisma.tmsaFinding.update({ where: { id }, data: { deletedAt: new Date(), deletedBy: user.id } });
  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "TmsaFinding",
    entityId: id,
    summary: `Deleted TMSA finding ${finding.code}`,
  });
  revalidateTmsa();
}

export async function updateFindingStatusAction(formData: FormData): Promise<void> {
  const user = await requirePermission("tmsa:manage-cap");
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !(TMSA_FINDING_STATUSES as readonly string[]).includes(status)) return;

  const finding = await prisma.tmsaFinding.findFirst({ where: { id, companyId: user.companyId, deletedAt: null } });
  if (!finding) return;

  await prisma.tmsaFinding.update({
    where: { id },
    data: { status: status as (typeof TMSA_FINDING_STATUSES)[number], updatedBy: user.id },
  });
  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "TmsaFinding",
    entityId: id,
    summary: `${finding.code} status set to ${status}`,
  });
  revalidateTmsa();
}

export async function updateFindingCorrectiveActionAction(formData: FormData): Promise<void> {
  const user = await requirePermission("tmsa:manage-cap");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const finding = await prisma.tmsaFinding.findFirst({ where: { id, companyId: user.companyId, deletedAt: null } });
  if (!finding) return;

  await prisma.tmsaFinding.update({
    where: { id },
    data: { correctiveAction: String(formData.get("correctiveAction") ?? "").trim(), updatedBy: user.id },
  });
  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "TmsaFinding",
    entityId: id,
    summary: `${finding.code} corrective action edited`,
  });
  revalidateTmsa();
}

export async function updateFindingResponsibleAction(formData: FormData): Promise<void> {
  const user = await requirePermission("tmsa:manage-cap");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const finding = await prisma.tmsaFinding.findFirst({ where: { id, companyId: user.companyId, deletedAt: null } });
  if (!finding) return;

  await prisma.tmsaFinding.update({
    where: { id },
    data: { responsible: String(formData.get("responsible") ?? "").trim(), updatedBy: user.id },
  });
  revalidateTmsa();
}

export async function updateFindingTargetAction(formData: FormData): Promise<void> {
  const user = await requirePermission("tmsa:manage-cap");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const finding = await prisma.tmsaFinding.findFirst({ where: { id, companyId: user.companyId, deletedAt: null } });
  if (!finding) return;

  const raw = String(formData.get("target") ?? "").trim();
  const target = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
  await prisma.tmsaFinding.update({ where: { id }, data: { target, updatedBy: user.id } });
  revalidateTmsa();
}

// Full edit from the finding detail page.
export async function updateFindingAction(formData: FormData): Promise<void> {
  const user = await requirePermission("tmsa:manage-cap");
  const parsed = updateFindingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const d = parsed.data;

  const finding = await prisma.tmsaFinding.findFirst({ where: { id: d.id, companyId: user.companyId, deletedAt: null } });
  if (!finding) return;

  const rawTarget = d.target ?? "";
  const target = /^\d{4}-\d{2}-\d{2}$/.test(rawTarget) ? rawTarget : "";

  await prisma.tmsaFinding.update({
    where: { id: d.id },
    data: {
      status: d.status,
      correctiveAction: d.correctiveAction || "",
      responsible: d.responsible || "",
      target,
      updatedBy: user.id,
    },
  });
  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "TmsaFinding",
    entityId: d.id,
    summary: `${finding.code} corrective action plan updated`,
  });
  revalidatePath("/tmsa/cap");
  redirect("/tmsa/cap");
}
