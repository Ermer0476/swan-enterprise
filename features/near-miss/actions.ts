"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import type { NearMissStatus, NearMissKind } from "@/lib/generated/prisma";
import { CAPA_PREFIX } from "@/features/capa/schema";
import {
  createNearMissSchema,
  officeReviewSchema,
  buildCapaRows,
  NM_STATUSES,
  positionsFor,
} from "./schema";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

function nextStatus(current: NearMissStatus): NearMissStatus | null {
  const i = NM_STATUSES.indexOf(current);
  return (NM_STATUSES[i + 1] as NearMissStatus | undefined) ?? null;
}

// Near Miss and HOR keep their own familiar ref-number prefixes even though
// they now share one table — each counted independently by kind.
async function nextRefNo(companyId: string, kind: NearMissKind): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = kind === "HOR" ? `HOR-${year}-` : `NM-${year}-`;
  const count = await prisma.nearMiss.count({
    where: { companyId, kind, refNo: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

export async function createNearMissAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("nm:create");
  const parsed = createNearMissSchema.safeParse({
    title: formData.get("title"),
    reporterName: formData.get("reporterName"),
    reporterPosition: formData.get("reporterPosition"),
    kind: formData.get("kind") || "NEAR_MISS",
    horCategory: formData.get("horCategory") || undefined,
    stopAuthorityExercised: formData.get("stopAuthorityExercised") === "on",
    vesselId: formData.get("vesselId"),
    occurredAt: formData.get("occurredAt"),
    location: formData.get("location"),
    description: formData.get("description"),
    potentialConsequence: formData.get("potentialConsequence"),
    potentialSeverity: formData.get("potentialSeverity"),
    immediateAction: formData.get("immediateAction"),
    rootCauseCategory: formData.get("rootCauseCategory"),
    rootCauseSubCategory: formData.get("rootCauseSubCategory"),
    caAction: formData.getAll("caAction").map(String),
    caResponsible: formData.getAll("caResponsible").map(String),
    caTargetDate: formData.getAll("caTargetDate").map(String),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const d = parsed.data;

  // Position options are department-scoped (ship ranks vs office positions —
  // never mixed); re-check server-side since the client list is just the UI.
  if (!positionsFor(user.department).includes(d.reporterPosition)) {
    return fail("Select a valid position for your department");
  }

  const nm = await prisma.nearMiss.create({
    data: {
      companyId: user.companyId,
      refNo: await nextRefNo(user.companyId, d.kind),
      title: d.title,
      reporterName: d.reporterName,
      reporterPosition: d.reporterPosition,
      kind: d.kind,
      horCategory: d.kind === "HOR" ? d.horCategory : null,
      stopAuthorityExercised: d.kind === "HOR" ? d.stopAuthorityExercised : false,
      vesselId: d.vesselId || null,
      occurredAt: new Date(d.occurredAt),
      location: d.location || null,
      description: d.description,
      potentialConsequence: d.potentialConsequence,
      potentialSeverity: d.potentialSeverity,
      immediateAction: d.immediateAction || null,
      rootCauseCategory: d.rootCauseCategory,
      rootCauseSubCategory: d.rootCauseSubCategory,
      status: "REPORTED",
      reportedById: user.id,
      createdBy: user.id,
      updatedBy: user.id,
    },
  });

  const capaRows = buildCapaRows(d.caAction, d.caResponsible, d.caTargetDate);
  if (capaRows.length > 0) {
    await prisma.capaAction.createMany({
      data: capaRows.map((r, i) => ({
        companyId: user.companyId,
        entityType: "NearMiss",
        entityId: nm.id,
        kind: "CORRECTIVE",
        code: `${CAPA_PREFIX.CORRECTIVE}-${String(i + 1).padStart(2, "0")}`,
        action: r.action,
        responsible: r.responsible || null,
        targetDate: r.targetDate ? new Date(r.targetDate) : null,
        status: "OPEN",
        createdBy: user.id,
        updatedBy: user.id,
      })),
    });
  }

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "NearMiss",
    entityId: nm.id,
    summary: `Reported near miss ${nm.refNo} — ${nm.title}`,
  });

  revalidatePath("/near-miss");
  redirect(`/near-miss/${nm.id}`);
}

export async function saveOfficeReviewAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("nm:update");
  const parsed = officeReviewSchema.safeParse({
    nearMissId: formData.get("nearMissId"),
    companyComments: formData.get("companyComments"),
    reviewedAt: formData.get("reviewedAt"),
  });
  if (!parsed.success) return fail("Invalid input");

  const nm = await prisma.nearMiss.findFirst({
    where: { id: parsed.data.nearMissId, companyId: user.companyId, deletedAt: null },
  });
  if (!nm) return fail("Near miss not found");
  if (nm.status === "CLOSED") return fail("Closed near misses are read-only");

  await prisma.nearMiss.update({
    where: { id: nm.id },
    data: {
      companyComments: parsed.data.companyComments || null,
      reviewedAt: parsed.data.reviewedAt ? new Date(parsed.data.reviewedAt) : null,
      status: nm.status === "REPORTED" ? "UNDER_REVIEW" : nm.status,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "NearMiss",
    entityId: nm.id,
    summary: `Office review recorded for ${nm.refNo}`,
  });

  revalidatePath(`/near-miss/${nm.id}`);
  return OK;
}

export async function advanceNearMissAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("nm:update");
  const id = String(formData.get("nearMissId") ?? "");
  const nm = await prisma.nearMiss.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!nm) return fail("Near miss not found");

  const next = nextStatus(nm.status);
  if (!next) return fail("Near miss is already closed");
  if (next === "CLOSED" && !user.permissions.has("nm:close")) {
    return fail("You don't have permission to close near misses");
  }
  if (next === "CLOSED") {
    const openCapaCount = await prisma.capaAction.count({
      where: {
        companyId: user.companyId,
        entityType: "NearMiss",
        entityId: nm.id,
        deletedAt: null,
        status: { not: "CLOSED" },
      },
    });
    if (openCapaCount > 0) {
      return fail(
        `Close all corrective actions before closing the near miss (${openCapaCount} still open).`,
      );
    }
  }

  await prisma.nearMiss.update({
    where: { id: nm.id },
    data: {
      status: next,
      closedAt: next === "CLOSED" ? new Date() : nm.closedAt,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: next === "CLOSED" ? "APPROVE" : "UPDATE",
    entityType: "NearMiss",
    entityId: nm.id,
    summary: `${nm.refNo} advanced to ${next}`,
  });

  revalidatePath(`/near-miss/${nm.id}`);
  return OK;
}

export async function deleteNearMissAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("nm:delete");
  const id = String(formData.get("nearMissId") ?? "");
  const nm = await prisma.nearMiss.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!nm) return fail("Near miss not found");

  await prisma.nearMiss.update({
    where: { id: nm.id },
    data: { deletedAt: new Date(), deletedBy: user.id },
  });
  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "NearMiss",
    entityId: nm.id,
    summary: `Deleted near miss ${nm.refNo}`,
  });

  revalidatePath("/near-miss");
  redirect("/near-miss");
}
