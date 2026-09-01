"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { allocateRefNo } from "@/lib/ref-sequence";
import type { NearMissStatus, NearMissKind, CapaStatus } from "@/lib/generated/prisma";
import { CAPA_PREFIX, CAPA_STATUSES } from "@/features/capa/schema";
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
// they now share one table — each allocated independently by kind. A
// vessel-raised report is further prefixed with the vessel's fleet code
// (SWA-NM-2026-0001) so two ships' Nth report of the year never look alike;
// shore-raised reports fall into the plain NM-2026-0001 / HOR-2026-0001
// bucket.
async function nextRefNo(companyId: string, kind: NearMissKind, vesselCode: string | null): Promise<string> {
  const year = new Date().getFullYear();
  const base = kind === "HOR" ? `HOR-${year}` : `NM-${year}`;
  return allocateRefNo(companyId, vesselCode ? `${vesselCode}-${base}` : base);
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
    caStatus: formData.getAll("caStatus").map(String),
    caClosedDate: formData.getAll("caClosedDate").map(String),
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

  // "Save as Draft" is available to anyone who can create a near miss —
  // shipboard AND office. A draft stays visible to the vessel fleet-wide
  // (existing behavior) or to its own creator if raised from the office
  // (see queries.ts's ownDraft clause), so it's never orphaned either way.
  const status: NearMissStatus = formData.get("intent") === "draft" ? "DRAFT" : "REPORTED";

  const capaRows = buildCapaRows(d.caAction, d.caResponsible, d.caTargetDate, d.caStatus, d.caClosedDate);
  // A report can't reach the office with no corrective action plan at all —
  // if nothing's ready yet, it should stay a Draft until it is.
  if (status === "REPORTED" && capaRows.length === 0) {
    return fail("Add at least one corrective action before reporting — or Save as Draft to finish it later.");
  }

  let vesselCode: string | null = null;
  if (d.vesselId) {
    const vessel = await prisma.vessel.findFirst({
      where: { id: d.vesselId, companyId: user.companyId },
      select: { code: true },
    });
    if (!vessel) return fail("Vessel not found");
    vesselCode = vessel.code;
  }

  const nm = await prisma.nearMiss.create({
    data: {
      companyId: user.companyId,
      // A draft hasn't been reported yet, so it doesn't burn a ref number —
      // one is assigned only when reportDraftNearMissAction moves it to
      // REPORTED (or immediately below, for a non-draft submission).
      refNo: status === "REPORTED" ? await nextRefNo(user.companyId, d.kind, vesselCode) : null,
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
      status,
      reportedById: user.id,
      createdBy: user.id,
      updatedBy: user.id,
    },
  });

  if (capaRows.length > 0) {
    // A corrective action can only be filed as already In Progress/Closed by
    // the vessel itself — an office-filed report always starts every row OPEN.
    const isShipboard = user.department === "SHIPBOARD";
    await prisma.capaAction.createMany({
      data: capaRows.map((r, i) => {
        const status: CapaStatus =
          isShipboard && CAPA_STATUSES.includes(r.status as (typeof CAPA_STATUSES)[number])
            ? (r.status as CapaStatus)
            : "OPEN";
        return {
          companyId: user.companyId,
          entityType: "NearMiss",
          entityId: nm.id,
          kind: "CORRECTIVE",
          code: `${CAPA_PREFIX.CORRECTIVE}-${String(i + 1).padStart(2, "0")}`,
          action: r.action,
          responsible: r.responsible || null,
          targetDate: r.targetDate ? new Date(r.targetDate) : null,
          status,
          closedDate: status === "CLOSED" && r.closedDate ? new Date(r.closedDate) : null,
          createdBy: user.id,
          updatedBy: user.id,
        };
      }),
    });
  }

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "NearMiss",
    entityId: nm.id,
    summary:
      status === "REPORTED"
        ? `Reported near miss ${nm.refNo} — ${nm.title}`
        : `Saved draft — ${nm.title}`,
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
    shoreRemarks: formData.get("shoreRemarks"),
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
      shoreRemarks: parsed.data.shoreRemarks || null,
      reviewedAt: parsed.data.reviewedAt ? new Date(parsed.data.reviewedAt) : null,
      status: nm.status === "REPORTED" ? "UNDER_REVIEW" : nm.status,
      updatedBy: user.id,
      shoreRemarksByUserId: parsed.data.shoreRemarks ? user.id : null,
      shoreRemarksAt: parsed.data.shoreRemarks ? new Date() : null,
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
  // DRAFT → REPORTED is a vessel-only step (reportDraftNearMissAction) — the
  // office never even sees a draft to advance it from here.
  if (nm.status === "DRAFT") return fail("This report is still a draft — the vessel must submit it first");

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

/** Submits a Draft for office review — status DRAFT → REPORTED. Any
 * shipboard user can submit any vessel's draft (shared logins); an
 * office-raised draft can only be submitted by the office user who created
 * it. */
export async function reportDraftNearMissAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("nm:create");
  const id = String(formData.get("nearMissId") ?? "");
  const nm = await prisma.nearMiss.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null, status: "DRAFT" },
  });
  if (!nm) return fail("Draft not found");
  if (user.department !== "SHIPBOARD" && nm.createdBy !== user.id) {
    return fail("Only the report's creator (or the vessel) can submit this draft");
  }

  const capaCount = await prisma.capaAction.count({
    where: { companyId: user.companyId, entityType: "NearMiss", entityId: nm.id, deletedAt: null },
  });
  if (capaCount === 0) {
    return fail("Add at least one corrective action before reporting to the office.");
  }

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
      `Close all corrective actions before reporting to the office (${openCapaCount} still open).`,
    );
  }

  // Only assigned now — a draft that's abandoned or edited repeatedly never
  // burns a sequence number.
  let vesselCode: string | null = null;
  if (nm.vesselId) {
    const vessel = await prisma.vessel.findFirst({
      where: { id: nm.vesselId, companyId: user.companyId },
      select: { code: true },
    });
    vesselCode = vessel?.code ?? null;
  }
  const refNo = await nextRefNo(user.companyId, nm.kind, vesselCode);
  await prisma.nearMiss.update({
    where: { id: nm.id },
    data: { status: "REPORTED", refNo, updatedBy: user.id },
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "NearMiss",
    entityId: nm.id,
    summary: `Submitted draft — now ${refNo} — for office review`,
  });

  revalidatePath(`/near-miss/${nm.id}`);
  revalidatePath("/near-miss");
  return OK;
}

/**
 * Fully edits a Draft's own report fields (everything except the corrective
 * action rows, which the shared CAPA tracker already lets the owner
 * add/remove/edit in place). Any shipboard user can edit any vessel's draft
 * (shared logins); an office-raised draft can only be edited by the office
 * user who created it. Locked to DRAFT so a REPORTED/CLOSED record — now
 * visible to and possibly already reviewed by the office — can't be
 * silently rewritten out from under them.
 */
export async function updateDraftNearMissAction(
  nearMissId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("nm:create");
  const nm = await prisma.nearMiss.findFirst({
    where: { id: nearMissId, companyId: user.companyId, deletedAt: null, status: "DRAFT" },
  });
  if (!nm) return fail("Draft not found");
  if (user.department !== "SHIPBOARD" && nm.createdBy !== user.id) {
    return fail("Only the report's creator (or the vessel) can edit this draft");
  }

  const parsed = createNearMissSchema.safeParse({
    title: formData.get("title"),
    reporterName: formData.get("reporterName"),
    reporterPosition: formData.get("reporterPosition"),
    kind: formData.get("kind") || "NEAR_MISS",
    horCategory: formData.get("horCategory") || undefined,
    stopAuthorityExercised: formData.get("stopAuthorityExercised") === "on",
    // Vessel is locked (not resubmitted) — the edit form only shows it as
    // read-only text, so it's left out of the record entirely rather than
    // touched below.
    vesselId: undefined,
    occurredAt: formData.get("occurredAt"),
    location: formData.get("location"),
    description: formData.get("description"),
    potentialConsequence: formData.get("potentialConsequence"),
    potentialSeverity: formData.get("potentialSeverity"),
    immediateAction: formData.get("immediateAction"),
    rootCauseCategory: formData.get("rootCauseCategory"),
    rootCauseSubCategory: formData.get("rootCauseSubCategory"),
    caAction: [],
    caResponsible: [],
    caTargetDate: [],
    caStatus: [],
    caClosedDate: [],
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const d = parsed.data;

  if (!positionsFor(user.department).includes(d.reporterPosition)) {
    return fail("Select a valid position for your department");
  }

  await prisma.nearMiss.update({
    where: { id: nm.id },
    data: {
      title: d.title,
      reporterName: d.reporterName,
      reporterPosition: d.reporterPosition,
      kind: d.kind,
      horCategory: d.kind === "HOR" ? d.horCategory : null,
      stopAuthorityExercised: d.kind === "HOR" ? d.stopAuthorityExercised : false,
      occurredAt: new Date(d.occurredAt),
      location: d.location || null,
      description: d.description,
      potentialConsequence: d.potentialConsequence,
      potentialSeverity: d.potentialSeverity,
      immediateAction: d.immediateAction || null,
      rootCauseCategory: d.rootCauseCategory,
      rootCauseSubCategory: d.rootCauseSubCategory,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "NearMiss",
    entityId: nm.id,
    summary: `Updated draft — ${d.title}`,
  });

  revalidatePath(`/near-miss/${nm.id}`);
  return OK;
}

/** Deletes its own Draft — never a REPORTED/CLOSED record (use deleteNearMissAction for those, office-only). Any shipboard user may delete any vessel's draft (shared logins); an office-raised draft can only be deleted by its creator. */
export async function deleteDraftNearMissAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("nm:create");
  const id = String(formData.get("nearMissId") ?? "");
  const nm = await prisma.nearMiss.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null, status: "DRAFT" },
  });
  if (!nm) return fail("Draft not found");
  if (user.department !== "SHIPBOARD" && nm.createdBy !== user.id) {
    return fail("Only the report's creator (or the vessel) can delete this draft");
  }

  await prisma.nearMiss.update({
    where: { id: nm.id },
    data: { deletedAt: new Date(), deletedBy: user.id },
  });
  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "NearMiss",
    entityId: nm.id,
    summary: `Deleted draft — ${nm.title}`,
  });

  revalidatePath("/near-miss");
  redirect("/near-miss");
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
