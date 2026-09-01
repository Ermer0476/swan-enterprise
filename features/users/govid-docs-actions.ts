"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { randomUUID } from "crypto";
import nodePath from "path";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import {
  saveAttachmentFile,
  deleteAttachmentFile,
} from "@/features/attachments/storage";
import { MAX_ATTACHMENT_SIZE } from "@/features/attachments/schema";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

/**
 * Government-ID scan/photo documents attach to a USER through the existing,
 * entity-agnostic Attachment table — no schema change and no second file
 * store. The Attachment model has no category column, so the gov-ID type is
 * encoded in `entityType` as `user-govid:<TYPE>` with `entityId` = the user's
 * id. That keeps each type's document in its own storage folder
 * (attachmentDir → companyId/entityType/entityId) and lets a plain
 * findMany/findFirst filter by type, while the generic download route keeps
 * working unchanged.
 */
const GOVID_ENTITY_PREFIX = "user-govid:";

/** The four Philippine government IDs the office keeps on file. */
export const GOVID_TYPES = ["TIN", "SSS", "HDMF", "PHILHEALTH"] as const;
export type GovIdType = (typeof GOVID_TYPES)[number];

const isGovIdType = (v: string): v is GovIdType =>
  (GOVID_TYPES as readonly string[]).includes(v);

const entityTypeFor = (type: GovIdType): string => `${GOVID_ENTITY_PREFIX}${type}`;

/**
 * These are sensitive PII scans, so the allow-list is deliberately narrower
 * than the platform-wide attachments list: PDF plus the common image formats
 * only. Both the browser-declared MIME type AND the file extension must be in
 * the allow-list — the extension is what ends up on disk and in the download
 * filename, so a mismatched pair is rejected rather than trusted.
 */
const ALLOWED: ReadonlyArray<{ mime: string; exts: readonly string[] }> = [
  { mime: "application/pdf", exts: [".pdf"] },
  { mime: "image/png", exts: [".png"] },
  { mime: "image/jpeg", exts: [".jpg", ".jpeg"] },
  { mime: "image/webp", exts: [".webp"] },
];

function isAllowed(mime: string, ext: string): boolean {
  return ALLOWED.some(
    (a) => a.mime === mime && a.exts.includes(ext.toLowerCase()),
  );
}

export async function uploadGovIdDocAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  // Office-only: gov-ID scans are sensitive PII.
  const user = await requirePermission("admin:manage-users");

  const userId = String(formData.get("userId") ?? "");
  const govIdType = String(formData.get("govIdType") ?? "");

  if (!isGovIdType(govIdType)) {
    return fail("Unknown government-ID type");
  }
  // `userId` becomes a path segment in the storage layer, so it must be a
  // plain uuid — a value containing `../` would escape the storage root.
  const parsedUserId = z.string().uuid().safeParse(userId);
  if (!parsedUserId.success) {
    return fail("Invalid user");
  }

  // Confirm the target user exists inside the actor's company before writing
  // any file — never let one company attach documents onto another's user id.
  const target = await prisma.user.findFirst({
    where: { id: userId, companyId: user.companyId, deletedAt: null },
    select: { id: true },
  });
  if (!target) {
    return fail("User not found");
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return fail("Choose a file to upload");
  }
  if (file.size > MAX_ATTACHMENT_SIZE) {
    return fail(
      `File is too large (max ${Math.round(MAX_ATTACHMENT_SIZE / (1024 * 1024))}MB)`,
    );
  }
  const ext = nodePath.extname(file.name).slice(0, 20);
  if (!isAllowed(file.type, ext)) {
    return fail("Only PDF or image files (PDF, PNG, JPG, WEBP) are allowed");
  }

  const entityType = entityTypeFor(govIdType);

  // Single-slot per type: a replacement supersedes whatever was there so the
  // detail page always shows exactly one live document per gov-ID.
  const previous = await prisma.attachment.findMany({
    where: {
      companyId: user.companyId,
      entityType,
      entityId: userId,
      deletedAt: null,
    },
  });

  const storedName = `${randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const fileKey = await saveAttachmentFile(
    user.companyId,
    entityType,
    userId,
    storedName,
    buffer,
  );

  const attachment = await prisma.attachment.create({
    data: {
      companyId: user.companyId,
      entityType,
      entityId: userId,
      fileName: file.name,
      fileKey,
      mimeType: file.type,
      sizeBytes: file.size,
      createdBy: user.id,
    },
  });

  for (const old of previous) {
    await prisma.attachment.update({
      where: { id: old.id },
      data: { deletedAt: new Date(), deletedBy: user.id },
    });
    await deleteAttachmentFile(old.fileKey);
  }

  // Record the gov-ID TYPE, never the ID value itself.
  await writeAudit({
    actor: user,
    action: "UPLOAD",
    entityType: "Attachment",
    entityId: attachment.id,
    summary: `Uploaded ${govIdType} document for user ${userId}`,
    metadata: { govIdType, userId },
  });

  revalidatePath(`/settings/users/${userId}`);
  return OK;
}

export async function removeGovIdDocAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("admin:manage-users");
  const id = String(formData.get("id") ?? "");

  // Scope to this company AND to gov-ID attachments only — this action must
  // never be able to soft-delete some other module's attachment by id.
  const existing = await prisma.attachment.findFirst({
    where: {
      id,
      companyId: user.companyId,
      entityType: { startsWith: GOVID_ENTITY_PREFIX },
      deletedAt: null,
    },
  });
  if (!existing) return fail("Document not found");

  await prisma.attachment.update({
    where: { id: existing.id },
    data: { deletedAt: new Date(), deletedBy: user.id },
  });
  await deleteAttachmentFile(existing.fileKey);

  const govIdType = existing.entityType.slice(GOVID_ENTITY_PREFIX.length);
  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "Attachment",
    entityId: existing.id,
    summary: `Removed ${govIdType} document for user ${existing.entityId}`,
    metadata: { govIdType, userId: existing.entityId },
  });

  revalidatePath(`/settings/users/${existing.entityId}`);
  return OK;
}
