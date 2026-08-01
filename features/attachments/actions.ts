"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import nodePath from "path";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { requireUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import type { PermissionKey } from "@/lib/permissions";
import { saveAttachmentFile, deleteAttachmentFile } from "./storage";
import { ALLOWED_MIME_TYPES, MAX_ATTACHMENT_SIZE } from "./schema";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

/**
 * Registry mapping an entityType to the permission that gates uploads/deletes
 * and the page to revalidate — same entity-agnostic pattern as the CAPA
 * tracker. Register a new module here when it adopts attachments.
 */
const REGISTRY: Record<
  string,
  { permission: PermissionKey; pagePath: (id: string) => string | Promise<string> }
> = {
  Incident: { permission: "incident:update", pagePath: (id) => `/incidents/${id}` },
  // A SIRE observation has no page of its own — it lives inside its parent
  // inspection — so the path has to be looked up rather than derived from
  // the entityId directly.
  SireObservation: {
    permission: "sire:update",
    pagePath: async (observationId) => {
      const obs = await prisma.sireObservation.findUnique({
        where: { id: observationId },
        select: { inspectionId: true },
      });
      return `/sire/${obs?.inspectionId ?? ""}`;
    },
  },
};

function registryFor(entityType: string) {
  const entry = REGISTRY[entityType];
  if (!entry) {
    throw new Error(`Attachments are not registered for entityType "${entityType}"`);
  }
  return entry;
}

export async function uploadAttachmentAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const entityType = String(formData.get("entityType") ?? "");
  const entityId = String(formData.get("entityId") ?? "");
  const { permission, pagePath } = registryFor(entityType);
  const user = await requirePermission(permission);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return fail("Choose a file to upload");
  }
  if (file.size > MAX_ATTACHMENT_SIZE) {
    return fail(`File is too large (max ${Math.round(MAX_ATTACHMENT_SIZE / (1024 * 1024))}MB)`);
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return fail("File type is not supported");
  }

  const ext = nodePath.extname(file.name).slice(0, 20);
  const storedName = `${randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const fileKey = await saveAttachmentFile(user.companyId, entityType, entityId, storedName, buffer);

  const attachment = await prisma.attachment.create({
    data: {
      companyId: user.companyId,
      entityType,
      entityId,
      fileName: file.name,
      fileKey,
      mimeType: file.type,
      sizeBytes: file.size,
      createdBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "UPLOAD",
    entityType: "Attachment",
    entityId: attachment.id,
    summary: `Uploaded ${attachment.fileName} to ${entityType} ${entityId}`,
  });

  revalidatePath(await pagePath(entityId));
  return OK;
}

export async function deleteAttachmentAction(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  const existing = await prisma.attachment.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!existing) return fail("Attachment not found");

  const { permission, pagePath } = registryFor(existing.entityType);
  if (!user.permissions.has(permission)) {
    return fail("You don't have permission to delete this attachment");
  }

  await prisma.attachment.update({
    where: { id: existing.id },
    data: { deletedAt: new Date(), deletedBy: user.id },
  });
  await deleteAttachmentFile(existing.fileKey);

  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "Attachment",
    entityId: existing.id,
    summary: `Deleted attachment ${existing.fileName} from ${existing.entityType} ${existing.entityId}`,
  });

  revalidatePath(await pagePath(existing.entityId));
  return OK;
}
