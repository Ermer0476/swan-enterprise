import "server-only";
import { prisma } from "@/lib/prisma";

/** Attachments for one entity, newest first. */
export async function listAttachments(
  companyId: string,
  entityType: string,
  entityId: string,
) {
  return prisma.attachment.findMany({
    where: { companyId, entityType, entityId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Attachments for many entities of the same type at once, grouped by
 * entityId — for list pages that want to show/preview a file without a
 * per-row query (e.g. the Circulars table). No Prisma relation exists here
 * since Attachment is a polymorphic table keyed by (entityType, entityId),
 * not a foreign key, so this can't just be an `include`.
 */
export async function listAttachmentsForEntities(
  companyId: string,
  entityType: string,
  entityIds: string[],
) {
  if (entityIds.length === 0) return new Map<string, Awaited<ReturnType<typeof listAttachments>>>();
  const rows = await prisma.attachment.findMany({
    where: { companyId, entityType, entityId: { in: entityIds }, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  const byEntity = new Map<string, typeof rows>();
  for (const row of rows) {
    const existing = byEntity.get(row.entityId);
    if (existing) existing.push(row);
    else byEntity.set(row.entityId, [row]);
  }
  return byEntity;
}
