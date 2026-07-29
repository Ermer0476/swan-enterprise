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
