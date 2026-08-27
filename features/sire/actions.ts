"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import mammoth from "mammoth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { allocateRefNo } from "@/lib/ref-sequence";
import { ROOT_CAUSE_CATEGORIES } from "@/lib/root-cause";
import {
  createSireSchema,
  addObservationSchema,
  updateObservationSchema,
  addCommentSchema,
  updateSireTargetSchema,
  SIRE_OBSERVATION_CATEGORIES,
} from "./schema";
import { parseSireDraftResponse, type ParsedObservationDraft } from "./document-parser";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

async function nextRefNo(companyId: string, vesselCode: string | null): Promise<string> {
  const year = new Date().getFullYear();
  return allocateRefNo(companyId, vesselCode ? `${vesselCode}-SIRE-${year}` : `SIRE-${year}`);
}

export async function createSireAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("sire:create");
  const parsed = createSireSchema.safeParse({
    vesselId: formData.get("vesselId"),
    inspectingCompany: formData.get("inspectingCompany"),
    inspectorName: formData.get("inspectorName"),
    port: formData.get("port"),
    inspectionDate: formData.get("inspectionDate"),
    inspectionType: formData.get("inspectionType"),
    overallResult: formData.get("overallResult"),
    sireVersion: formData.get("sireVersion"),
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

  const insp = await prisma.sireInspection.create({
    data: {
      companyId: user.companyId,
      refNo: await nextRefNo(user.companyId, vesselCode),
      vesselId: d.vesselId || null,
      inspectingCompany: d.inspectingCompany,
      inspectorName: d.inspectorName,
      port: d.port || null,
      inspectionDate: new Date(d.inspectionDate),
      inspectionType: d.inspectionType || null,
      overallResult: d.overallResult || null,
      sireVersion: d.sireVersion || "2.0",
      summary: d.summary || null,
      status: "OPEN",
      createdBy: user.id,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "SireInspection",
    entityId: insp.id,
    summary: `Recorded SIRE inspection ${insp.refNo}`,
  });

  revalidatePath("/sire");
  redirect(`/sire/${insp.id}`);
}

export async function addObservationAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("sire:update");
  const parsed = addObservationSchema.safeParse({
    inspectionId: formData.get("inspectionId"),
    chapter: formData.get("chapter"),
    category: formData.get("category"),
    viqRef: formData.get("viqRef"),
    question: formData.get("question"),
    observation: formData.get("observation"),
    immediateCause: formData.get("immediateCause"),
    rootCauseCategory: formData.get("rootCauseCategory"),
    rootCauseSubCategory: formData.get("rootCauseSubCategory"),
    rootCause: formData.get("rootCause"),
    correctiveAction: formData.get("correctiveAction"),
    preventiveMeasure: formData.get("preventiveMeasure"),
    responsiblePersonId: formData.get("responsiblePersonId"),
    targetDate: formData.get("targetDate"),
    actualCompletionDate: formData.get("actualCompletionDate"),
    status: formData.get("status") || "OPEN",
    verifiedById: formData.get("verifiedById"),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const d = parsed.data;

  const insp = await prisma.sireInspection.findFirst({
    where: { id: d.inspectionId, companyId: user.companyId, deletedAt: null },
  });
  if (!insp) return fail("Inspection not found");
  if (insp.status === "CLOSED") return fail("Inspection is closed");

  // Optional FKs to User — validated only as uuids by the schema. Verify each
  // resolves within this company before writing, so a stale/removed user id
  // yields a clean fail rather than an uncaught P2003.
  if (d.responsiblePersonId) {
    const person = await prisma.user.findFirst({
      where: { id: d.responsiblePersonId, companyId: user.companyId },
      select: { id: true },
    });
    if (!person) return fail("Responsible person not found");
  }
  if (d.verifiedById) {
    const verifier = await prisma.user.findFirst({
      where: { id: d.verifiedById, companyId: user.companyId },
      select: { id: true },
    });
    if (!verifier) return fail("Verifier not found");
  }

  const seq = (await prisma.sireObservation.count({ where: { inspectionId: insp.id } })) + 1;

  await prisma.sireObservation.create({
    data: {
      companyId: user.companyId,
      inspectionId: insp.id,
      seq,
      chapter: d.chapter || null,
      category: d.category || null,
      viqRef: d.viqRef || null,
      question: d.question || null,
      observation: d.observation,
      immediateCause: d.immediateCause || null,
      rootCauseCategory: d.rootCauseCategory || null,
      rootCauseSubCategory: d.rootCauseSubCategory || null,
      rootCause: d.rootCause || null,
      correctiveAction: d.correctiveAction || null,
      preventiveMeasure: d.preventiveMeasure || null,
      responsiblePersonId: d.responsiblePersonId || null,
      targetDate: d.targetDate ? new Date(d.targetDate) : null,
      actualCompletionDate: d.actualCompletionDate ? new Date(d.actualCompletionDate) : null,
      status: d.status,
      verifiedById: d.verifiedById || null,
      createdBy: user.id,
    },
  });
  if (insp.status === "OPEN") {
    await prisma.sireInspection.update({
      where: { id: insp.id },
      data: { status: "IN_PROGRESS", updatedBy: user.id },
    });
  }

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "SireObservation",
    entityId: insp.id,
    summary: `Added observation ${seq} to ${insp.refNo}`,
  });

  revalidatePath(`/sire/${insp.id}`);
  return OK;
}

export async function updateObservationAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("sire:update");
  const parsed = updateObservationSchema.safeParse({
    observationId: formData.get("observationId"),
    chapter: formData.get("chapter"),
    category: formData.get("category"),
    viqRef: formData.get("viqRef"),
    question: formData.get("question"),
    observation: formData.get("observation"),
    immediateCause: formData.get("immediateCause"),
    rootCauseCategory: formData.get("rootCauseCategory"),
    rootCauseSubCategory: formData.get("rootCauseSubCategory"),
    rootCause: formData.get("rootCause"),
    correctiveAction: formData.get("correctiveAction"),
    preventiveMeasure: formData.get("preventiveMeasure"),
    responsiblePersonId: formData.get("responsiblePersonId"),
    targetDate: formData.get("targetDate"),
    actualCompletionDate: formData.get("actualCompletionDate"),
    status: formData.get("status") || "OPEN",
    verifiedById: formData.get("verifiedById"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const obs = await prisma.sireObservation.findFirst({
    where: { id: d.observationId, companyId: user.companyId, deletedAt: null },
  });
  if (!obs) return fail("Observation not found");

  // Optional FKs to User — verify each resolves within this company before
  // writing, so a stale/removed user id yields a clean fail rather than P2003.
  if (d.responsiblePersonId) {
    const person = await prisma.user.findFirst({
      where: { id: d.responsiblePersonId, companyId: user.companyId },
      select: { id: true },
    });
    if (!person) return fail("Responsible person not found");
  }
  if (d.verifiedById) {
    const verifier = await prisma.user.findFirst({
      where: { id: d.verifiedById, companyId: user.companyId },
      select: { id: true },
    });
    if (!verifier) return fail("Verifier not found");
  }

  await prisma.sireObservation.update({
    where: { id: obs.id },
    data: {
      chapter: d.chapter || null,
      category: d.category || null,
      viqRef: d.viqRef || null,
      question: d.question || null,
      observation: d.observation,
      immediateCause: d.immediateCause || null,
      rootCauseCategory: d.rootCauseCategory || null,
      rootCauseSubCategory: d.rootCauseSubCategory || null,
      rootCause: d.rootCause || null,
      correctiveAction: d.correctiveAction || null,
      preventiveMeasure: d.preventiveMeasure || null,
      responsiblePersonId: d.responsiblePersonId || null,
      targetDate: d.targetDate ? new Date(d.targetDate) : null,
      actualCompletionDate: d.actualCompletionDate ? new Date(d.actualCompletionDate) : null,
      status: d.status,
      verifiedById: d.verifiedById || null,
    },
  });

  revalidatePath(`/sire/${obs.inspectionId}`);
  return OK;
}

export async function deleteObservationAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("sire:update");
  const id = String(formData.get("observationId") ?? "");
  const obs = await prisma.sireObservation.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!obs) return fail("Observation not found");
  await prisma.sireObservation.update({
    where: { id: obs.id },
    data: { deletedAt: new Date() },
  });
  revalidatePath(`/sire/${obs.inspectionId}`);
  return OK;
}

export type ParseDocumentResult = {
  ok: boolean;
  error: string | null;
  drafts: ParsedObservationDraft[];
};

/**
 * Reads an uploaded SIRE Draft Response Template (.docx) and returns parsed
 * draft observations — nothing is saved here. The caller reviews/edits the
 * drafts client-side and only then calls bulkAddObservationsAction, so a
 * misread document never silently becomes bad data.
 */
export async function parseSireDocumentAction(
  _prev: ParseDocumentResult,
  formData: FormData,
): Promise<ParseDocumentResult> {
  await requirePermission("sire:update");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a file to upload", drafts: [] };
  }
  const isDocx =
    file.name.toLowerCase().endsWith(".docx") ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (!isDocx) {
    return { ok: false, error: "Only Word (.docx) files are supported", drafts: [] };
  }

  let text: string;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await mammoth.extractRawText({ buffer });
    text = result.value;
  } catch {
    return { ok: false, error: "Could not read this document — it may be corrupted", drafts: [] };
  }

  const drafts = parseSireDraftResponse(text);
  if (drafts.length === 0) {
    return {
      ok: false,
      error: "No observations were recognized — check the document matches the SIRE Draft Response Template format",
      drafts: [],
    };
  }
  return { ok: true, error: null, drafts };
}

const bulkDraftSchema = z.object({
  chapter: z.number().int().min(1).max(12).nullable(),
  // Required, same as the manual Add Observation form — both feed the SIRE
  // KPI, so an imported row can't skip them just because the source
  // document didn't state one; the reviewer must pick a value.
  category: z.enum(SIRE_OBSERVATION_CATEGORIES, { message: "Category is required" }),
  viqRef: z.string().trim().max(40).nullable(),
  question: z.string().trim().max(10000).nullable(),
  observation: z.string().trim().min(1).max(10000),
  immediateCause: z.string().trim().max(10000).nullable(),
  rootCauseCategory: z.enum(ROOT_CAUSE_CATEGORIES, { message: "Root cause category is required" }),
  rootCauseSubCategory: z.string().trim().max(60).nullable(),
  rootCause: z.string().trim().max(10000).nullable(),
  correctiveAction: z.string().trim().max(10000).nullable(),
  preventiveMeasure: z.string().trim().max(10000).nullable(),
});

/** Confirmed-by-reviewer drafts only — this is the actual save step. */
export async function bulkAddObservationsAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("sire:update");
  const inspectionId = String(formData.get("inspectionId") ?? "");

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("drafts") ?? "[]"));
  } catch {
    return fail("Invalid import payload");
  }
  const parsed = z.array(bulkDraftSchema).min(1).max(50).safeParse(raw);
  if (!parsed.success) return fail("Invalid import payload");
  const drafts = parsed.data;

  const insp = await prisma.sireInspection.findFirst({
    where: { id: inspectionId, companyId: user.companyId, deletedAt: null },
  });
  if (!insp) return fail("Inspection not found");
  if (insp.status === "CLOSED") return fail("Inspection is closed");

  let seq = await prisma.sireObservation.count({ where: { inspectionId: insp.id } });
  await prisma.$transaction(
    drafts.map((d) => {
      seq += 1;
      return prisma.sireObservation.create({
        data: {
          companyId: user.companyId,
          inspectionId: insp.id,
          seq,
          chapter: d.chapter,
          category: d.category,
          viqRef: d.viqRef,
          question: d.question,
          observation: d.observation,
          immediateCause: d.immediateCause,
          rootCauseCategory: d.rootCauseCategory,
          rootCauseSubCategory: d.rootCauseSubCategory,
          rootCause: d.rootCause,
          correctiveAction: d.correctiveAction,
          preventiveMeasure: d.preventiveMeasure,
          status: "OPEN",
          createdBy: user.id,
        },
      });
    }),
  );

  if (insp.status === "OPEN") {
    await prisma.sireInspection.update({
      where: { id: insp.id },
      data: { status: "IN_PROGRESS", updatedBy: user.id },
    });
  }

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "SireObservation",
    entityId: insp.id,
    summary: `Imported ${drafts.length} observation(s) into ${insp.refNo} from an uploaded document`,
  });

  revalidatePath(`/sire/${insp.id}`);
  return OK;
}

export async function addCommentAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("sire:update");
  const parsed = addCommentSchema.safeParse({
    observationId: formData.get("observationId"),
    body: formData.get("body"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const obs = await prisma.sireObservation.findFirst({
    where: { id: d.observationId, companyId: user.companyId, deletedAt: null },
  });
  if (!obs) return fail("Observation not found");

  await prisma.sireObservationComment.create({
    data: {
      companyId: user.companyId,
      observationId: obs.id,
      authorId: user.id,
      body: d.body,
    },
  });

  revalidatePath(`/sire/${obs.inspectionId}`);
  return OK;
}

export async function closeSireAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("sire:close");
  const id = String(formData.get("inspectionId") ?? "");
  const insp = await prisma.sireInspection.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
    include: {
      observations: { where: { deletedAt: null, status: { not: "CLOSED" } } },
    },
  });
  if (!insp) return fail("Inspection not found");
  if (insp.status === "CLOSED") return fail("Inspection is already closed");
  if (insp.observations.length > 0) {
    return fail("Close all observations before closing the inspection");
  }

  await prisma.sireInspection.update({
    where: { id: insp.id },
    data: { status: "CLOSED", closedAt: new Date(), updatedBy: user.id },
  });
  await writeAudit({
    actor: user,
    action: "APPROVE",
    entityType: "SireInspection",
    entityId: insp.id,
    summary: `Closed SIRE inspection ${insp.refNo}`,
  });

  revalidatePath(`/sire/${insp.id}`);
  return OK;
}

export async function updateSireTargetAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("sire:manage-targets");
  const parsed = updateSireTargetSchema.safeParse({
    avgObservationTarget: formData.get("avgObservationTarget"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  await prisma.company.update({
    where: { id: user.companyId },
    data: { sireAvgObservationTarget: d.avgObservationTarget },
  });
  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "Company",
    entityId: user.companyId,
    summary: `Set SIRE KPI target to Average Observations ≤ ${d.avgObservationTarget}`,
  });
  revalidatePath("/sire/kpi");
  revalidatePath("/settings/sire-kpi");
  return OK;
}

export async function deleteSireAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("sire:delete");
  const id = String(formData.get("inspectionId") ?? "");
  const insp = await prisma.sireInspection.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!insp) return fail("Inspection not found");
  await prisma.sireInspection.update({
    where: { id: insp.id },
    data: { deletedAt: new Date(), deletedBy: user.id },
  });
  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "SireInspection",
    entityId: insp.id,
    summary: `Deleted SIRE inspection ${insp.refNo}`,
  });
  revalidatePath("/sire");
  redirect("/sire");
}
