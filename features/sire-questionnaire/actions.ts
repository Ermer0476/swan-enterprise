"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { uploadQuestionnaireSchema } from "./schema";
import { parseQuestionnaireWorkbook } from "./document-parser";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

/** Uploads a new SIRE 2.0 Questionnaire version and makes it the active one
 * immediately — the whole point is that the office re-uploads whenever OCIMF
 * revises the VIQ, without a code change, and the new version takes over
 * suggestions right away. Older versions are kept (not deleted) as history. */
export async function uploadQuestionnaireVersionAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("sire-questionnaire:manage");
  const parsed = uploadQuestionnaireSchema.safeParse({ label: formData.get("label") });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return fail("Choose a file to upload");
  }
  const isSpreadsheet =
    /\.(xlsx|xlsm)$/i.test(file.name) ||
    file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.type === "application/vnd.ms-excel.sheet.macroEnabled.12";
  if (!isSpreadsheet) return fail("Only Excel files (.xlsx or .xlsm) are supported");

  const buffer = Buffer.from(await file.arrayBuffer());
  const { items, error } = parseQuestionnaireWorkbook(buffer);
  if (error) return fail(error);
  if (items.length === 0) return fail("No questions were recognized in this file");

  await prisma.$transaction(async (tx) => {
    await tx.sireQuestionnaireVersion.updateMany({
      where: { companyId: user.companyId, isActive: true },
      data: { isActive: false },
    });
    await tx.sireQuestionnaireVersion.create({
      data: {
        companyId: user.companyId,
        label: parsed.data.label,
        isActive: true,
        itemCount: items.length,
        createdBy: user.id,
        items: {
          create: items.map((it) => ({
            companyId: user.companyId,
            chapter: it.chapter,
            no: it.no,
            question: it.question,
            shortText: it.shortText,
            personInCharge: it.personInCharge,
            smsProcRefs: it.smsProcRefs,
          })),
        },
      },
    });
  });

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "SireQuestionnaireVersion",
    entityId: user.companyId,
    summary: `Uploaded SIRE 2.0 Questionnaire version "${parsed.data.label}" (${items.length} questions) — now active`,
  });

  revalidatePath("/settings/sire-questionnaire");
  return OK;
}

export async function activateVersionAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("sire-questionnaire:manage");
  const id = String(formData.get("versionId") ?? "");
  const version = await prisma.sireQuestionnaireVersion.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!version) return fail("Version not found");
  if (version.isActive) return OK;

  await prisma.$transaction([
    prisma.sireQuestionnaireVersion.updateMany({
      where: { companyId: user.companyId, isActive: true },
      data: { isActive: false },
    }),
    prisma.sireQuestionnaireVersion.update({
      where: { id: version.id },
      data: { isActive: true },
    }),
  ]);

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "SireQuestionnaireVersion",
    entityId: version.id,
    summary: `Activated SIRE 2.0 Questionnaire version "${version.label}"`,
  });

  revalidatePath("/settings/sire-questionnaire");
  return OK;
}

export async function deleteVersionAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("sire-questionnaire:manage");
  const id = String(formData.get("versionId") ?? "");
  const version = await prisma.sireQuestionnaireVersion.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!version) return fail("Version not found");

  await prisma.sireQuestionnaireVersion.update({
    where: { id: version.id },
    data: { deletedAt: new Date(), deletedBy: user.id, isActive: false },
  });

  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "SireQuestionnaireVersion",
    entityId: version.id,
    summary: `Deleted SIRE 2.0 Questionnaire version "${version.label}"`,
  });

  revalidatePath("/settings/sire-questionnaire");
  return OK;
}
