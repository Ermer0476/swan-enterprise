"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { Prisma, type NcrStatus, type NcrSource, type RootCauseCategory } from "@/lib/generated/prisma";
import {
  createNcrSchema,
  rootCauseSchema,
  verifyNcrSchema,
  closeNcrSchema,
  NCR_SHIP_CREATOR_RANKS,
} from "./schema";
import { suggestNextRefNo } from "./queries";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

/**
 * One finding = one NCR: once a source finding is raised into an NCR, the
 * NCR becomes the single source of truth for root cause and corrective
 * actions — carry over anything already recorded against the finding (rather
 * than leaving two independent, driftable copies) and re-parent its CAPA
 * rows so both pages read/write the exact same records from here.
 *
 * Called both at NCR creation and — critically — again at the moment a
 * Draft is actually submitted (reportDraftNcrAction): while the NCR is still
 * a Draft it has no refNo, so the source finding's panel can't yet detect
 * the link and falls back to its own root-cause fields, meaning anything
 * typed there while the NCR sat in Draft would otherwise never reach it.
 */
async function inheritFromSourceFinding(
  companyId: string,
  ncr: { id: string; source: NcrSource; sourceEntityId: string | null; targetDate: Date | null },
) {
  if (!ncr.sourceEntityId) return;
  let sourceRootCause: { rootCauseCategory: RootCauseCategory | null; rootCauseSubCategory: string | null; rootCause: string | null } | null = null;
  let sourceEntityType: string | null = null;

  if (ncr.source === "PSC") {
    sourceEntityType = "PscDeficiency";
    sourceRootCause = await prisma.pscDeficiency.findFirst({
      where: { id: ncr.sourceEntityId, companyId },
      select: { rootCauseCategory: true, rootCauseSubCategory: true, rootCause: true },
    });
  } else if (ncr.source === "INTERNAL_AUDIT") {
    sourceEntityType = "InternalAuditFinding";
    sourceRootCause = await prisma.internalAuditFinding.findFirst({
      where: { id: ncr.sourceEntityId, companyId },
      select: { rootCauseCategory: true, rootCauseSubCategory: true, rootCause: true },
    });
  } else if (ncr.source === "EXTERNAL_AUDIT") {
    sourceEntityType = "ExternalAuditFinding";
    sourceRootCause = await prisma.externalAuditFinding.findFirst({
      where: { id: ncr.sourceEntityId, companyId },
      select: { rootCauseCategory: true, rootCauseSubCategory: true, rootCause: true },
    });
  } else if (ncr.source === "FLAG_STATE") {
    sourceEntityType = "FlagInspectionFinding";
    sourceRootCause = await prisma.flagInspectionFinding.findFirst({
      where: { id: ncr.sourceEntityId, companyId },
      select: { rootCauseCategory: true, rootCauseSubCategory: true, rootCause: true },
    });
  }
  if (!sourceEntityType) return;

  await prisma.capaAction.updateMany({
    where: { companyId, entityType: sourceEntityType, entityId: ncr.sourceEntityId },
    data: { entityType: "NonConformity", entityId: ncr.id },
  });

  // The NCR's own targetDate is the overall "resolve by" date for the whole
  // record — if it isn't set yet, fall back to the earliest target date
  // already on the finding's (now re-parented) corrective actions, so it
  // doesn't sit blank when the office already committed to a date there.
  let inheritedTargetDate: Date | undefined;
  if (!ncr.targetDate) {
    const earliestCapa = await prisma.capaAction.findFirst({
      where: { companyId, entityType: "NonConformity", entityId: ncr.id, deletedAt: null, targetDate: { not: null } },
      orderBy: { targetDate: "asc" },
      select: { targetDate: true },
    });
    inheritedTargetDate = earliestCapa?.targetDate ?? undefined;
  }

  if (sourceRootCause?.rootCauseCategory || sourceRootCause?.rootCause || inheritedTargetDate) {
    await prisma.nonConformity.update({
      where: { id: ncr.id },
      data: {
        ...(sourceRootCause?.rootCauseCategory
          ? { rootCauseCategory: sourceRootCause.rootCauseCategory, rootCauseSubCategory: sourceRootCause.rootCauseSubCategory }
          : {}),
        ...(sourceRootCause?.rootCause ? { rootCause: sourceRootCause.rootCause } : {}),
        ...(inheritedTargetDate ? { targetDate: inheritedTargetDate } : {}),
      },
    });
  }
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
  const status: NcrStatus = formData.get("intent") === "draft" ? "DRAFT" : "SUBMITTED_TO_OFFICE";
  const parsed = createNcrSchema.safeParse({
    title: formData.get("title"),
    vesselId: formData.get("vesselId"),
    departmentName: formData.get("departmentName"),
    source: formData.get("source"),
    sourceEntityId: formData.get("sourceEntityId"),
    requirement: formData.get("requirement"),
    severity: formData.get("severity"),
    raisedAt: formData.get("raisedAt"),
    targetDate: formData.get("targetDate"),
    description: formData.get("description"),
    personInCharge: formData.get("personInCharge"),
    reporterName: formData.get("reporterName"),
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
    const refNo = status === "SUBMITTED_TO_OFFICE" ? await suggestNextRefNo(user.companyId, vesselCode) : null;

    try {
      ncr = await prisma.nonConformity.create({
        data: {
          companyId: user.companyId,
          refNo,
          title: d.title,
          vesselId: d.vesselId || null,
          departmentName: d.departmentName || null,
          source: d.source,
          sourceEntityId: d.sourceEntityId || null,
          requirement: d.requirement,
          severity: d.severity,
          raisedAt: new Date(d.raisedAt),
          targetDate: d.targetDate ? new Date(d.targetDate) : null,
          description: d.description,
          personInCharge: d.personInCharge,
          reporterName: d.reporterName || null,
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

  await inheritFromSourceFinding(user.companyId, {
    id: ncr.id,
    source: ncr.source,
    sourceEntityId: ncr.sourceEntityId,
    targetDate: ncr.targetDate,
  });

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "NonConformity",
    entityId: ncr.id,
    summary:
      status === "SUBMITTED_TO_OFFICE" ? `Raised NCR ${ncr.refNo} — ${ncr.title}` : `Saved draft — ${ncr.title}`,
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

  await prisma.nonConformity.update({
    where: { id: ncr.id },
    data: {
      rootCauseCategory: d.rootCauseCategory,
      rootCauseSubCategory: d.rootCauseSubCategory,
      rootCause: d.rootCause || null,
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

/**
 * R-AS-001 section 6 — DPA / Safety Mgt. Committee verification of the
 * corrective action. Gates SUBMITTED_TO_OFFICE → VERIFIED; carries forward
 * the same root-cause/CAPA-closed prerequisites that used to gate the old
 * single-step "advance to CLOSED" transition.
 */
export async function verifyNcrAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("ncr:close");
  const id = String(formData.get("ncrId") ?? "");
  const ncr = await prisma.nonConformity.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!ncr) return fail("Non-conformity not found");
  if (ncr.status !== "SUBMITTED_TO_OFFICE") {
    return fail("This NCR is not awaiting verification");
  }
  if (!ncr.rootCauseCategory) {
    return fail("Record a root cause before verifying");
  }

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
    return fail(`Close all CAPA items before verifying the NCR (${openCapaCount} still open).`);
  }

  const parsed = verifyNcrSchema.safeParse({
    ncrId: id,
    verificationOutcome: formData.get("verificationOutcome"),
    // These two fields are only rendered in the DOM when relevant (see
    // VerificationForm) — formData.get() on a field that was never present
    // returns null, which fails the schema's .optional() (that only accepts
    // undefined/"", not null), so coerce to "" here.
    verificationFollowUpNature: formData.get("verificationFollowUpNature") ?? "",
    assistanceRequired: formData.get("assistanceRequired") === "on",
    assistanceNature: formData.get("assistanceNature") ?? "",
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const d = parsed.data;

  await prisma.nonConformity.update({
    where: { id: ncr.id },
    data: {
      status: "VERIFIED",
      verificationOutcome: d.verificationOutcome,
      verificationFollowUpNature: d.verificationOutcome === "FOLLOWUP_REQUIRED" ? d.verificationFollowUpNature || null : null,
      assistanceRequired: d.assistanceRequired,
      assistanceNature: d.assistanceRequired ? d.assistanceNature || null : null,
      verifiedByUserId: user.id,
      verifiedAt: new Date(),
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "APPROVE",
    entityType: "NonConformity",
    entityId: ncr.id,
    summary: `${ncr.refNo} verified — ${d.verificationOutcome === "COMPLETED" ? "completed per SMS" : "follow-up required"}`,
  });

  revalidatePath(`/non-conformities/${ncr.id}`);
  return OK;
}

/**
 * R-AS-001 section 7 — Close Out. Gates VERIFIED → CLOSED; a record can
 * still flag its own follow-up here, separate from anything already noted
 * at verification.
 */
export async function closeNcrAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("ncr:close");
  const id = String(formData.get("ncrId") ?? "");
  const ncr = await prisma.nonConformity.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!ncr) return fail("Non-conformity not found");
  if (ncr.status !== "VERIFIED") {
    return fail("Verify this NCR before closing it out");
  }

  const parsed = closeNcrSchema.safeParse({
    ncrId: id,
    closeOutFollowUpRequired: formData.get("closeOutFollowUpRequired") === "on",
    // Only rendered in the DOM when follow-up is chosen (see CloseOutForm) —
    // coerce null (field absent) to "" so .optional() doesn't reject it.
    closeOutFollowUpNature: formData.get("closeOutFollowUpNature") ?? "",
    closedOutDate: formData.get("closedOutDate"),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const d = parsed.data;

  await prisma.nonConformity.update({
    where: { id: ncr.id },
    data: {
      status: "CLOSED",
      closedAt: new Date(d.closedOutDate),
      closeOutFollowUpRequired: d.closeOutFollowUpRequired,
      closeOutFollowUpNature: d.closeOutFollowUpRequired ? d.closeOutFollowUpNature || null : null,
      closedByUserId: user.id,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "APPROVE",
    entityType: "NonConformity",
    entityId: ncr.id,
    summary: `${ncr.refNo} closed out`,
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
 * reports it straight to the office (status DRAFT → SUBMITTED_TO_OFFICE, no
 * separate "raised but not yet submitted" stop). Available to the same
 * senior-officer ranks as raising one in the first place, since this IS the
 * act of actually raising it.
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
        data: { status: "SUBMITTED_TO_OFFICE", refNo, updatedBy: user.id },
      });
      break;
    } catch (err) {
      const isDuplicate = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
      if (!isDuplicate || attempt >= 5) throw err;
    }
  }

  // Re-pull from the source finding now, not just at the Draft's original
  // creation — while this NCR had no refNo, its source finding's panel
  // couldn't detect the link and fell back to its own root-cause fields, so
  // anything recorded there since the Draft was created never reached the
  // NCR until now.
  await inheritFromSourceFinding(user.companyId, {
    id: ncr.id,
    source: ncr.source,
    sourceEntityId: ncr.sourceEntityId,
    targetDate: ncr.targetDate,
  });

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
    departmentName: formData.get("departmentName"),
    source: formData.get("source"),
    sourceEntityId: formData.get("sourceEntityId"),
    requirement: formData.get("requirement"),
    severity: formData.get("severity"),
    raisedAt: formData.get("raisedAt"),
    targetDate: formData.get("targetDate"),
    description: formData.get("description"),
    personInCharge: formData.get("personInCharge"),
    reporterName: formData.get("reporterName"),
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
      departmentName: d.departmentName || null,
      source: d.source,
      sourceEntityId: d.sourceEntityId || null,
      requirement: d.requirement,
      severity: d.severity,
      raisedAt: new Date(d.raisedAt),
      targetDate: d.targetDate ? new Date(d.targetDate) : null,
      description: d.description,
      personInCharge: d.personInCharge,
      reporterName: d.reporterName || null,
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
