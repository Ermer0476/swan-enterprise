"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import nodePath from "path";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { saveAttachmentFile } from "@/features/attachments/storage";
import { ALLOWED_MIME_TYPES, MAX_ATTACHMENT_SIZE } from "@/features/attachments/schema";
import { createCircularSchema } from "./schema";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

async function nextRefNo(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `CIR-${year}-`;
  const count = await prisma.circular.count({
    where: { companyId, refNo: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

export async function createCircularAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("circular:create");
  const parsed = createCircularSchema.safeParse({
    title: formData.get("title"),
    vesselId: formData.get("vesselId"),
    source: formData.get("source"),
    issuingBody: formData.get("issuingBody"),
    category: formData.get("category"),
    issueDate: formData.get("issueDate"),
    dateReceived: formData.get("dateReceived"),
    body: formData.get("body"),
    notifyUserIds: formData.getAll("notifyUserIds"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  // Every circular is the record of an actual document received/issued —
  // the source PDF/scan itself, not just its typed-up content — so at
  // least one file is required at creation, not optional-and-added-later.
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return fail("Attach the circular document (at least one file)");
  for (const file of files) {
    if (file.size > MAX_ATTACHMENT_SIZE) {
      return fail(`"${file.name}" is too large (max ${Math.round(MAX_ATTACHMENT_SIZE / (1024 * 1024))}MB)`);
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return fail(`"${file.name}" is not a supported file type`);
    }
  }

  // Distribution is computed once, at creation: every targeted vessel (all
  // active vessels when fleet-wide, or just the one selected) gets an
  // acknowledgement row automatically, plus one row per office user
  // explicitly picked to be tracked individually (e.g. the Superintendent —
  // the actual complaint this feature was built for: emailed but never
  // read). Recipients aren't recomputed on edit; this is a snapshot of who
  // needed to see it at the time it was issued.
  const targetVessels = d.vesselId
    ? await prisma.vessel.findMany({ where: { id: d.vesselId, companyId: user.companyId }, select: { id: true, name: true } })
    : await prisma.vessel.findMany({ where: { companyId: user.companyId, deletedAt: null, status: "ACTIVE" }, select: { id: true, name: true } });

  const notifyUsers = d.notifyUserIds.length
    ? await prisma.user.findMany({ where: { id: { in: d.notifyUserIds }, companyId: user.companyId }, select: { id: true, fullName: true } })
    : [];

  const circular = await prisma.circular.create({
    data: {
      companyId: user.companyId,
      refNo: await nextRefNo(user.companyId),
      title: d.title,
      vesselId: d.vesselId || null,
      source: d.source,
      issuingBody: d.issuingBody || null,
      category: d.category,
      issueDate: new Date(d.issueDate),
      dateReceived: d.dateReceived ? new Date(d.dateReceived) : null,
      body: d.body,
      createdBy: user.id,
      updatedBy: user.id,
      acknowledgements: {
        create: [
          ...targetVessels.map((v) => ({
            companyId: user.companyId,
            recipientType: "VESSEL",
            recipientId: v.id,
            recipientLabel: v.name,
          })),
          ...notifyUsers.map((u) => ({
            companyId: user.companyId,
            recipientType: "USER",
            recipientId: u.id,
            recipientLabel: u.fullName,
          })),
        ],
      },
    },
  });

  for (const file of files) {
    const ext = nodePath.extname(file.name).slice(0, 20);
    const storedName = `${randomUUID()}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileKey = await saveAttachmentFile(user.companyId, "Circular", circular.id, storedName, buffer);
    await prisma.attachment.create({
      data: {
        companyId: user.companyId,
        entityType: "Circular",
        entityId: circular.id,
        fileName: file.name,
        fileKey,
        mimeType: file.type,
        sizeBytes: file.size,
        createdBy: user.id,
      },
    });
  }

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "Circular",
    entityId: circular.id,
    summary: `Issued circular ${circular.refNo} — ${circular.title} (${files.length} file${files.length === 1 ? "" : "s"} attached)`,
  });

  revalidatePath("/circulars");
  redirect(`/circulars/${circular.id}`);
}

/**
 * Acknowledges the current user's own recipient row on a circular — a
 * shipboard user acknowledges on behalf of their vessel; an office user
 * acknowledges their own named row. Replaces "sent an email nobody opened"
 * with an explicit, trackable read receipt.
 */
export async function acknowledgeCircularAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("circular:read");
  const circularId = String(formData.get("circularId") ?? "");

  const recipientType = user.department === "SHIPBOARD" ? "VESSEL" : "USER";
  const recipientId = user.department === "SHIPBOARD" ? (user.vesselId ?? "") : user.id;
  if (!recipientId) return fail("No vessel assigned to your account");

  const row = await prisma.circularAcknowledgement.findFirst({
    where: { companyId: user.companyId, circularId, recipientType, recipientId },
  });
  if (!row) return fail("You are not on the distribution list for this circular");
  if (row.acknowledgedAt) return OK; // already acknowledged — no-op

  await prisma.circularAcknowledgement.update({
    where: { id: row.id },
    data: { acknowledgedAt: new Date(), acknowledgedById: user.id, acknowledgedByName: user.fullName },
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "Circular",
    entityId: circularId,
    summary: `${user.fullName} acknowledged circular`,
  });

  revalidatePath(`/circulars/${circularId}`);
  return OK;
}

export async function deleteCircularAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("circular:delete");
  const id = String(formData.get("circularId") ?? "");
  const circular = await prisma.circular.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!circular) return fail("Circular not found");

  await prisma.circular.update({
    where: { id: circular.id },
    data: { deletedAt: new Date(), deletedBy: user.id },
  });

  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "Circular",
    entityId: circular.id,
    summary: `Deleted circular ${circular.refNo}`,
  });

  revalidatePath("/circulars");
  redirect("/circulars");
}
