"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { getReferenceListValues } from "@/lib/reference-list";
import { rootCauseSubcategoryKey } from "@/lib/reference-registry";
import { Prisma, type NcrStatus, type RootCauseCategory } from "@/lib/generated/prisma";
import { createNcrSchema, rootCauseSchema, shoreRemarksSchema, NCR_STATUSES, NCR_SHIP_CREATOR_RANKS } from "./schema";
import { suggestNextRefNo } from "./queries";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

function nextStatus(current: NcrStatus): NcrStatus | null {
  const i = NCR_STATUSES.indexOf(current);
  return (NCR_STATUSES[i + 1] as NcrStatus | undefined) ?? null;
}

export async function createNcrAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("ncr:create");
  // Shipboard NCR creation is restricted to senior officers — office roles
  // with ncr:create are already manager-tier, so no extra check there. This
  // also gates Draft creation: a draft is still "raising an NCR", just not
  // finalized yet.
  if (
    user.department === "SHIPBOARD" &&
    !(user.rank && (NCR_SHIP_CREATOR_RANKS as readonly string[]).includes(user.rank))
  ) {
    return fail("Only Master, Chief Officer, or Chief Engineer may raise an NCR onboard");
  }
  const status: NcrStatus = formData.get("intent") === "draft" ? "DRAFT" : "OPEN";
  const parsed = createNcrSchema.safeParse({
    title: formData.get("title"),
    vesselId: formData.get("vesselId"),
    source: formData.get("source"),
    sourceEntityId: formData.get("sourceEntityId"),
    requirement: formData.get("requirement"),
    severity: formData.get("severity"),
    raisedAt: formData.get("raisedAt"),
    targetDate: formData.get("targetDate"),
    description: formData.get("description"),
    personInCharge: formData.get("personInCharge"),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const d = parsed.data;

  // Each vessel keeps its own NCR sequence, prefixed with its fleet code
  // (SWA-NCR-2026-0001), so two ships' Nth NCR of the year never collide —
  // shore-raised NCRs (no vessel) fall into a plain NCR-2026-0001 bucket.
  let vesselCode: string | null = null;
  if (d.vesselId) {
    const vessel = await prisma.vessel.findFirst({
      where: { id: d.vesselId, companyId: user.companyId },
      select: { code: true },
    });
    if (!vessel) return fail("Vessel not found");
    if (!vessel.code) return fail("This vessel has no NCR code set — add one in Vessel Master first");
    vesselCode = vessel.code;
  }

  // Number is assigned here, not typed by the user — always taken from the
  // last NCR on record for this vessel (or the shore bucket) for the current
  // year, so it can't drift out of sequence or collide with one someone else
  // just raised. The unique constraint on (companyId, refNo) is the real
  // guard against a race with a concurrent submission; on that rare
  // conflict, re-derive (the other submission is committed by now, so this
  // naturally advances) and retry. A Draft never burns a number — it stays
  // null until the draft is actually reported (see reportDraftNcrAction).
  let ncr;
  for (let attempt = 0; ; attempt++) {
    const refNo = status === "OPEN" ? await suggestNextRefNo(user.companyId, vesselCode) : null;

    try {
      ncr = await prisma.nonConformity.create({
        data: {
          companyId: user.companyId,
          refNo,
          title: d.title,
          vesselId: d.vesselId || null,
          source: d.source,
          sourceEntityId: d.sourceEntityId || null,
          requirement: d.requirement,
          severity: d.severity,
          raisedAt: new Date(d.raisedAt),
          targetDate: d.targetDate ? new Date(d.targetDate) : null,
          description: d.description,
          personInCharge: d.personInCharge,
          status,
          raisedById: user.id,
          createdBy: user.id,
          updatedBy: user.id,
        },
      });
      break;
    } catch (err) {
      const isDuplicate = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
      if (!isDuplicate || attempt >= 5) throw err;
    }
  }

  // One finding = one NCR: once a source finding is raised into an NCR, the
  // NCR becomes the single source of truth for root cause and corrective
  // actions — carry over anything already recorded against the finding
  // (rather than leaving two independent, driftable copies) and re-parent
  // its CAPA rows so both pages read/write the exact same records from here.
  if (d.sourceEntityId) {
    let sourceRootCause: { rootCauseCategory: RootCauseCategory | null; rootCauseSubCategory: string | null } | null = null;
    let sourceEntityType: string | null = null;

    if (d.source === "PSC") {
      sourceEntityType = "PscDeficiency";
      sourceRootCause = await prisma.pscDeficiency.findFirst({
        where: { id: d.sourceEntityId, companyId: user.companyId },
        select: { rootCauseCategory: true, rootCauseSubCategory: true },
      });
    } else if (d.source === "INTERNAL_AUDIT") {
      sourceEntityType = "InternalAuditFinding";
      sourceRootCause = await prisma.internalAuditFinding.findFirst({
        where: { id: d.sourceEntityId, companyId: user.companyId },
        select: { rootCauseCategory: true, rootCauseSubCategory: true },
      });
    } else if (d.source === "EXTERNAL_AUDIT") {
      sourceEntityType = "ExternalAuditFinding";
      sourceRootCause = await prisma.externalAuditFinding.findFirst({
        where: { id: d.sourceEntityId, companyId: user.companyId },
        select: { rootCauseCategory: true, rootCauseSubCategory: true },
      });
    }

    if (sourceEntityType) {
      if (sourceRootCause?.rootCauseCategory) {
        await prisma.nonConformity.update({
          where: { id: ncr.id },
          data: {
            rootCauseCategory: sourceRootCause.rootCauseCategory,
            rootCauseSubCategory: sourceRootCause.rootCauseSubCategory,
          },
        });
      }
      await prisma.capaAction.updateMany({
        where: { companyId: user.companyId, entityType: sourceEntityType, entityId: d.sourceEntityId },
        data: { entityType: "NonConformity", entityId: ncr.id },
      });
    }
  }

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "NonConformity",
    entityId: ncr.id,
    summary:
      status === "OPEN" ? `Raised NCR ${ncr.refNo} — ${ncr.title}` : `Saved draft — ${ncr.title}`,
  });

  revalidatePath("/non-conformities");
  redirect(`/non-conformities/${ncr.id}`);
}

export async function saveRootCauseAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("ncr:update");
  const parsed = rootCauseSchema.safeParse({
    ncrId: formData.get("ncrId"),
    rootCauseCategory: formData.get("rootCauseCategory"),
    rootCauseSubCategory: formData.get("rootCauseSubCategory"),
    rootCause: formData.get("rootCause"),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const d = parsed.data;

  const ncr = await prisma.nonConformity.findFirst({
    where: { id: d.ncrId, companyId: user.companyId, deletedAt: null },
  });
  if (!ncr) return fail("Non-conformity not found");
  if (ncr.status === "CLOSED") return fail("Closed NCRs are read-only");

  // Root-cause sub-category must be a live option for the chosen category —
  // checked against the office-editable list ∪ the value already persisted, so
  // re-saving a root cause that holds a now-hidden sub-category never fails.
  const allowedSub = await getReferenceListValues(
    user.companyId,
    rootCauseSubcategoryKey(d.rootCauseCategory),
  );
  if (!allowedSub.has(d.rootCauseSubCategory) && d.rootCauseSubCategory !== ncr.rootCauseSubCategory) {
    return fail("Select a valid sub-category for the chosen root cause");
  }

  await prisma.nonConformity.update({
    where: { id: ncr.id },
    data: {
      rootCauseCategory: d.rootCauseCategory,
      rootCauseSubCategory: d.rootCauseSubCategory,
      rootCause: d.rootCause || null,
      status: ncr.status === "OPEN" ? "SUBMITTED_TO_OFFICE" : ncr.status,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "NonConformity",
    entityId: ncr.id,
    summary: `Recorded root cause for ${ncr.refNo}`,
  });

  revalidatePath(`/non-conformities/${ncr.id}`);
  return OK;
}

export async function saveShoreRemarksAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("ncr:update");
  const parsed = shoreRemarksSchema.safeParse({
    ncrId: formData.get("ncrId"),
    shoreRemarks: formData.get("shoreRemarks"),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const d = parsed.data;

  const ncr = await prisma.nonConformity.findFirst({
    where: { id: d.ncrId, companyId: user.companyId, deletedAt: null },
  });
  if (!ncr) return fail("Non-conformity not found");
  if (ncr.status === "CLOSED") return fail("Closed NCRs are read-only");

  await prisma.nonConformity.update({
    where: { id: ncr.id },
    data: {
      shoreRemarks: d.shoreRemarks || null,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "NonConformity",
    entityId: ncr.id,
    summary: `Shore remarks recorded for ${ncr.refNo}`,
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
  // A draft never advances through this generic path — it has no refNo yet,
  // and this action doesn't assign one. Use reportDraftNcrAction.
  if (ncr.status === "DRAFT") return fail("Report this draft first");

  const next = nextStatus(ncr.status);
  if (!next) return fail("NCR is already closed");
  // Closing IS the verification act — only DPA / General Manager hold
  // ncr:close (mirrors Incident's "Verified by Management" pattern).
  if (next === "CLOSED" && !user.permissions.has("ncr:close")) {
    return fail("You don't have permission to verify/close NCRs");
  }
  if (next === "CLOSED" && !ncr.rootCauseCategory) {
    return fail("Record a root cause before verifying");
  }
  if (next === "CLOSED") {
    const openCapaCount = await prisma.capaAction.count({
      where: {
        companyId: user.companyId,
        entityType: "NonConformity",
        entityId: ncr.id,
        deletedAt: null,
        status: { not: "CLOSED" },
      },
    });
    if (openCapaCount > 0) {
      return fail(
        `Close all CAPA items before closing the NCR (${openCapaCount} still open).`,
      );
    }
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

/**
 * Submits a Draft — assigns its refNo (never done at draft-save time) and
 * moves it to OPEN. Available to the same senior-officer ranks as raising
 * one in the first place, since this IS the act of actually raising it.
 */
export async function reportDraftNcrAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("ncr:create");
  if (
    user.department === "SHIPBOARD" &&
    !(user.rank && (NCR_SHIP_CREATOR_RANKS as readonly string[]).includes(user.rank))
  ) {
    return fail("Only Master, Chief Officer, or Chief Engineer may raise an NCR onboard");
  }
  const id = String(formData.get("ncrId") ?? "");
  const ncr = await prisma.nonConformity.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null, status: "DRAFT" },
  });
  if (!ncr) return fail("Draft not found");
  if (user.department !== "SHIPBOARD" && ncr.createdBy !== user.id) {
    return fail("Only the draft's creator (or the vessel) can report this draft");
  }

  let vesselCode: string | null = null;
  if (ncr.vesselId) {
    const vessel = await prisma.vessel.findFirst({
      where: { id: ncr.vesselId, companyId: user.companyId },
      select: { code: true },
    });
    vesselCode = vessel?.code ?? null;
  }

  let refNo: string | undefined;
  for (let attempt = 0; ; attempt++) {
    refNo = await suggestNextRefNo(user.companyId, vesselCode);
    try {
      await prisma.nonConformity.update({
        where: { id: ncr.id },
        data: { status: "OPEN", refNo, updatedBy: user.id },
      });
      break;
    } catch (err) {
      const isDuplicate = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
      if (!isDuplicate || attempt >= 5) throw err;
    }
  }

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "NonConformity",
    entityId: ncr.id,
    summary: `Raised NCR ${refNo} — ${ncr.title}`,
  });

  revalidatePath("/non-conformities");
  revalidatePath(`/non-conformities/${ncr.id}`);
  return OK;
}

/** Full edit of a Draft's own report fields — locked to DRAFT status only. */
export async function updateDraftNcrAction(
  ncrId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("ncr:create");
  const ncr = await prisma.nonConformity.findFirst({
    where: { id: ncrId, companyId: user.companyId, deletedAt: null, status: "DRAFT" },
  });
  if (!ncr) return fail("Draft not found");
  if (user.department !== "SHIPBOARD" && ncr.createdBy !== user.id) {
    return fail("Only the draft's creator (or the vessel) can edit this draft");
  }

  const parsed = createNcrSchema.safeParse({
    title: formData.get("title"),
    vesselId: formData.get("vesselId"),
    source: formData.get("source"),
    sourceEntityId: formData.get("sourceEntityId"),
    requirement: formData.get("requirement"),
    severity: formData.get("severity"),
    raisedAt: formData.get("raisedAt"),
    targetDate: formData.get("targetDate"),
    description: formData.get("description"),
    personInCharge: formData.get("personInCharge"),
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

  await prisma.nonConformity.update({
    where: { id: ncr.id },
    data: {
      title: d.title,
      vesselId: d.vesselId || null,
      source: d.source,
      sourceEntityId: d.sourceEntityId || null,
      requirement: d.requirement,
      severity: d.severity,
      raisedAt: new Date(d.raisedAt),
      targetDate: d.targetDate ? new Date(d.targetDate) : null,
      description: d.description,
      personInCharge: d.personInCharge,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "NonConformity",
    entityId: ncr.id,
    summary: `Updated draft — ${d.title}`,
  });

  revalidatePath(`/non-conformities/${ncr.id}`);
  return OK;
}

/** Deletes its own Draft — soft delete, DRAFT status only. */
export async function deleteDraftNcrAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("ncr:create");
  const id = String(formData.get("ncrId") ?? "");
  const ncr = await prisma.nonConformity.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null, status: "DRAFT" },
  });
  if (!ncr) return fail("Draft not found");
  if (user.department !== "SHIPBOARD" && ncr.createdBy !== user.id) {
    return fail("Only the draft's creator (or the vessel) can delete this draft");
  }

  await prisma.nonConformity.update({
    where: { id: ncr.id },
    data: { deletedAt: new Date(), deletedBy: user.id },
  });
  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "NonConformity",
    entityId: ncr.id,
    summary: `Deleted draft — ${ncr.title}`,
  });

  revalidatePath("/non-conformities");
  redirect("/non-conformities");
}
