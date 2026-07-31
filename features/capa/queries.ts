import "server-only";
import { prisma } from "@/lib/prisma";
import type { CapaKind } from "@/lib/generated/prisma";

/** CAPA rows for one entity, one kind (Corrective or Preventive), in creation order. */
export async function listCapaActions(
  companyId: string,
  entityType: string,
  entityId: string,
  kind: CapaKind,
) {
  return prisma.capaAction.findMany({
    where: { companyId, entityType, entityId, kind, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
}

/** All CAPA rows for one entity, both kinds combined — for a merged tracker view. */
export async function listAllCapaActions(
  companyId: string,
  entityType: string,
  entityId: string,
) {
  return prisma.capaAction.findMany({
    where: { companyId, entityType, entityId, deletedAt: null },
    orderBy: [{ kind: "asc" }, { code: "asc" }],
  });
}

/**
 * All CAPA rows for many entities of one type at once (e.g. every deficiency
 * on a PSC inspection) — one query instead of one per entity. Callers group
 * the result by `entityId` themselves.
 */
export async function listAllCapaActionsForEntities(
  companyId: string,
  entityType: string,
  entityIds: string[],
) {
  if (entityIds.length === 0) return [];
  return prisma.capaAction.findMany({
    where: { companyId, entityType, entityId: { in: entityIds }, deletedAt: null },
    orderBy: [{ entityId: "asc" }, { kind: "asc" }, { code: "asc" }],
  });
}
