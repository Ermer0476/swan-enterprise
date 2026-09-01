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

// Every module that has adopted the CAPA tracker — see the REGISTRY in
// features/capa/actions.ts. Kept as its own list here (not imported from
// actions.ts) since that file also carries Server Action-only concerns
// (permissions, revalidatePath) this read-only query has no business with.
const ALL_CAPA_ENTITY_TYPES = [
  "Incident",
  "NearMiss",
  "NonConformity",
  "PscDeficiency",
  "InternalAuditFinding",
  "ExternalAuditFinding",
  "FlagInspectionFinding",
  "CompanyInspectionObservation",
];

/** CAPA closure rate across every module that uses the tracker (Incidents,
 * Near Miss, NCR, PSC, Internal/External Audits, Company Inspections
 * combined) — an all-time operational snapshot, same convention as
 * IncidentKpis.capaClosureRate, just not scoped to one module. Returns null
 * when there are no CAPA items anywhere yet (same "nothing to divide"
 * convention, not a 0% that would misleadingly read as "failing").
 *
 * Pass `vesselId` to scope to one vessel's own items — CapaAction has no
 * vesselId of its own (entityType/entityId is a loose polymorphic pair, no
 * FK), so scoping means first collecting which entity ids belong to that
 * vessel, per module, then filtering CapaAction against that combined set. */
export async function getFleetCapaClosureRate(companyId: string, vesselId?: string): Promise<{ closed: number; total: number; rate: number | null }> {
  if (!vesselId) {
    const rows = await prisma.capaAction.findMany({
      where: { companyId, entityType: { in: ALL_CAPA_ENTITY_TYPES }, deletedAt: null },
      select: { status: true },
    });
    const closed = rows.filter((r) => r.status === "CLOSED").length;
    return { closed, total: rows.length, rate: rows.length > 0 ? Math.round((closed / rows.length) * 100) : null };
  }

  const [incidents, nearMisses, ncrs, pscDeficiencies, iaFindings, eaFindings, fiFindings, ciObservations] = await Promise.all([
    prisma.incident.findMany({ where: { companyId, vesselId, deletedAt: null }, select: { id: true } }),
    prisma.nearMiss.findMany({ where: { companyId, vesselId, deletedAt: null }, select: { id: true } }),
    prisma.nonConformity.findMany({ where: { companyId, vesselId, deletedAt: null }, select: { id: true } }),
    prisma.pscDeficiency.findMany({ where: { companyId, inspection: { vesselId } }, select: { id: true } }),
    prisma.internalAuditFinding.findMany({ where: { companyId, audit: { vesselId } }, select: { id: true } }),
    prisma.externalAuditFinding.findMany({ where: { companyId, audit: { vesselId } }, select: { id: true } }),
    prisma.flagInspectionFinding.findMany({ where: { companyId, audit: { vesselId } }, select: { id: true } }),
    prisma.companyInspectionObservation.findMany({ where: { companyId, inspection: { vesselId } }, select: { id: true } }),
  ]);

  const idsByType: Record<string, string[]> = {
    Incident: incidents.map((r) => r.id),
    NearMiss: nearMisses.map((r) => r.id),
    NonConformity: ncrs.map((r) => r.id),
    PscDeficiency: pscDeficiencies.map((r) => r.id),
    InternalAuditFinding: iaFindings.map((r) => r.id),
    ExternalAuditFinding: eaFindings.map((r) => r.id),
    FlagInspectionFinding: fiFindings.map((r) => r.id),
    CompanyInspectionObservation: ciObservations.map((r) => r.id),
  };

  const rows = (
    await Promise.all(
      ALL_CAPA_ENTITY_TYPES.map((entityType) => {
        const entityIds = idsByType[entityType] ?? [];
        if (entityIds.length === 0) return Promise.resolve([]);
        return prisma.capaAction.findMany({
          where: { companyId, entityType, entityId: { in: entityIds }, deletedAt: null },
          select: { status: true },
        });
      }),
    )
  ).flat();

  const closed = rows.filter((r) => r.status === "CLOSED").length;
  return { closed, total: rows.length, rate: rows.length > 0 ? Math.round((closed / rows.length) * 100) : null };
}
