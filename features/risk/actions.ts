"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { createRiskAssessmentSchema } from "./schema";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

async function nextRefNo(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `RA-${year}-`;
  const count = await prisma.riskAssessment.count({
    where: { companyId, refNo: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

export async function createRiskAssessmentAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("risk:create");
  const parsed = createRiskAssessmentSchema.safeParse({
    activity: formData.get("activity"),
    vesselId: formData.get("vesselId"),
    hazards: formData.get("hazards"),
    existingControls: formData.get("existingControls"),
    likelihood: formData.get("likelihood"),
    severity: formData.get("severity"),
    additionalControls: formData.get("additionalControls"),
    assessedBy: formData.get("assessedBy"),
    assessmentDate: formData.get("assessmentDate"),
    reviewDate: formData.get("reviewDate"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const ra = await prisma.riskAssessment.create({
    data: {
      companyId: user.companyId,
      refNo: await nextRefNo(user.companyId),
      activity: d.activity,
      vesselId: d.vesselId || null,
      hazards: d.hazards,
      existingControls: d.existingControls || null,
      likelihood: d.likelihood,
      severity: d.severity,
      additionalControls: d.additionalControls || null,
      assessedBy: d.assessedBy || null,
      assessmentDate: new Date(d.assessmentDate),
      reviewDate: d.reviewDate ? new Date(d.reviewDate) : null,
      status: "ACTIVE",
      createdBy: user.id,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "RiskAssessment",
    entityId: ra.id,
    summary: `Recorded risk assessment ${ra.refNo} — ${ra.activity}`,
  });

  revalidatePath("/risk");
  redirect(`/risk/${ra.id}`);
}

export async function closeRiskAssessmentAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("risk:close");
  const id = String(formData.get("riskId") ?? "");
  const ra = await prisma.riskAssessment.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!ra) return fail("Risk assessment not found");
  if (ra.status !== "ACTIVE") return fail("Already closed/superseded");

  await prisma.riskAssessment.update({
    where: { id: ra.id },
    data: { status: "CLOSED", closedAt: new Date(), updatedBy: user.id },
  });

  await writeAudit({
    actor: user,
    action: "APPROVE",
    entityType: "RiskAssessment",
    entityId: ra.id,
    summary: `Closed risk assessment ${ra.refNo}`,
  });

  revalidatePath(`/risk/${ra.id}`);
  return OK;
}

export async function deleteRiskAssessmentAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("risk:delete");
  const id = String(formData.get("riskId") ?? "");
  const ra = await prisma.riskAssessment.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!ra) return fail("Risk assessment not found");

  await prisma.riskAssessment.update({
    where: { id: ra.id },
    data: { deletedAt: new Date(), deletedBy: user.id },
  });

  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "RiskAssessment",
    entityId: ra.id,
    summary: `Deleted risk assessment ${ra.refNo}`,
  });

  revalidatePath("/risk");
  redirect("/risk");
}
