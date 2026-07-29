"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import type { NcrStatus } from "@/lib/generated/prisma";
import { createNcrSchema, capaNcrSchema, NCR_STATUSES } from "./schema";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

function nextStatus(current: NcrStatus): NcrStatus | null {
  const i = NCR_STATUSES.indexOf(current);
  return (NCR_STATUSES[i + 1] as NcrStatus | undefined) ?? null;
}

async function nextRefNo(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `NCR-${year}-`;
  const count = await prisma.nonConformity.count({
    where: { companyId, refNo: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

export async function createNcrAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("ncr:create");
  const parsed = createNcrSchema.safeParse({
    title: formData.get("title"),
    vesselId: formData.get("vesselId"),
    source: formData.get("source"),
    requirement: formData.get("requirement"),
    severity: formData.get("severity"),
    raisedAt: formData.get("raisedAt"),
    targetDate: formData.get("targetDate"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const d = parsed.data;

  const ncr = await prisma.nonConformity.create({
    data: {
      companyId: user.companyId,
      refNo: await nextRefNo(user.companyId),
      title: d.title,
      vesselId: d.vesselId || null,
      source: d.source,
      requirement: d.requirement,
      severity: d.severity,
      raisedAt: new Date(d.raisedAt),
      targetDate: d.targetDate ? new Date(d.targetDate) : null,
      description: d.description,
      status: "OPEN",
      raisedById: user.id,
      createdBy: user.id,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "NonConformity",
    entityId: ncr.id,
    summary: `Raised NCR ${ncr.refNo} — ${ncr.title}`,
  });

  revalidatePath("/non-conformities");
  redirect(`/non-conformities/${ncr.id}`);
}

export async function saveCapaAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("ncr:update");
  const parsed = capaNcrSchema.safeParse({
    ncrId: formData.get("ncrId"),
    rootCause: formData.get("rootCause"),
    correctiveAction: formData.get("correctiveAction"),
    verification: formData.get("verification"),
  });
  if (!parsed.success) return fail("Invalid input");
  const d = parsed.data;

  const ncr = await prisma.nonConformity.findFirst({
    where: { id: d.ncrId, companyId: user.companyId, deletedAt: null },
  });
  if (!ncr) return fail("Non-conformity not found");
  if (ncr.status === "CLOSED") return fail("Closed NCRs are read-only");

  await prisma.nonConformity.update({
    where: { id: ncr.id },
    data: {
      rootCause: d.rootCause || null,
      correctiveAction: d.correctiveAction || null,
      verification: d.verification || null,
      status: ncr.status === "OPEN" ? "IN_PROGRESS" : ncr.status,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "NonConformity",
    entityId: ncr.id,
    summary: `Updated CAPA for ${ncr.refNo}`,
  });

  revalidatePath(`/non-conformities/${ncr.id}`);
  return OK;
}

export async function advanceNcrAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("ncr:update");
  const id = String(formData.get("ncrId") ?? "");
  const ncr = await prisma.nonConformity.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!ncr) return fail("Non-conformity not found");

  const next = nextStatus(ncr.status);
  if (!next) return fail("NCR is already closed");
  // Verifying and closing both require the close permission.
  if ((next === "VERIFIED" || next === "CLOSED") && !user.permissions.has("ncr:close")) {
    return fail("You don't have permission to verify/close NCRs");
  }
  if (next === "VERIFIED" && !ncr.correctiveAction) {
    return fail("Record a corrective action before verifying");
  }

  await prisma.nonConformity.update({
    where: { id: ncr.id },
    data: {
      status: next,
      closedAt: next === "CLOSED" ? new Date() : ncr.closedAt,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: next === "CLOSED" ? "APPROVE" : "UPDATE",
    entityType: "NonConformity",
    entityId: ncr.id,
    summary: `${ncr.refNo} advanced to ${next}`,
  });

  revalidatePath(`/non-conformities/${ncr.id}`);
  return OK;
}

export async function deleteNcrAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("ncr:delete");
  const id = String(formData.get("ncrId") ?? "");
  const ncr = await prisma.nonConformity.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!ncr) return fail("Non-conformity not found");

  await prisma.nonConformity.update({
    where: { id: ncr.id },
    data: { deletedAt: new Date(), deletedBy: user.id },
  });
  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "NonConformity",
    entityId: ncr.id,
    summary: `Deleted NCR ${ncr.refNo}`,
  });

  revalidatePath("/non-conformities");
  redirect("/non-conformities");
}
