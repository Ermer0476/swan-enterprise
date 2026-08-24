import "server-only";
import { prisma } from "@/lib/prisma";
import { buildFleetDrillMatrix, MONTHLY_FREQUENCY_DAYS_MAX } from "@/features/schedule/queries";
import { getExpiryWarningMonths, computeWarningStatus } from "@/features/vessel-documents/queries";
import { listSireSchedule, type SireScheduleRow } from "@/features/sire/queries";
import { listInternalAuditSchedule, type InternalAuditScheduleRow } from "@/features/internal-audits/queries";
import { listFleetProcurementStatus } from "@/features/procurement/queries";
import { listFleetLastEntries } from "@/features/vessel-tracker/queries";

const OPEN_INCIDENT_STATUSES = ["REPORTED", "UNDER_INVESTIGATION", "ACTION_PENDING"] as const;

export type CapaModuleBreakdown = { module: string; count: number };

// Display label per CAPA-adopting entity type, in a fixed display order —
// same 7 types as ALL_CAPA_ENTITY_TYPES in features/capa/queries.ts. Every
// vessel's capaPendingByModule always has one entry per key here (0 when
// that module has nothing pending), so the Vessel Health panel can show the
// full picture across every module rather than only the ones with a
// nonzero count right now.
const CAPA_ENTITY_TYPE_LABELS: Record<string, string> = {
  CompanyInspectionObservation: "Company Inspection",
  PscDeficiency: "PSC",
  ExternalAuditFinding: "External Audit",
  InternalAuditFinding: "Internal Audit",
  NonConformity: "NCR",
  Incident: "Incident",
  NearMiss: "Near Miss",
};
const CAPA_ENTITY_TYPE_ORDER = Object.keys(CAPA_ENTITY_TYPE_LABELS);

/** Fleet-wide version of countVesselPendingCapa's entity collection, plus
 * the two signals (open incident investigations, open near-miss reports)
 * that share the same Incident/NearMiss rows — one pass over the whole
 * company instead of a per-vessel loop. Returns four vesselId-keyed maps. */
async function computeFleetIncidentCapaSignals(companyId: string): Promise<{
  capaPendingByVessel: Map<string, number>;
  capaPendingTypeCountsByVessel: Map<string, Map<string, number>>;
  incidentsPendingByVessel: Map<string, number>;
  nearMissOpenByVessel: Map<string, number>;
}> {
  const [incidents, nearMisses, ncrs, pscInspections, internalAudits, externalAudits, companyInspections] =
    await Promise.all([
      prisma.incident.findMany({ where: { companyId, deletedAt: null }, select: { id: true, vesselId: true, status: true } }),
      prisma.nearMiss.findMany({
        where: { companyId, deletedAt: null },
        select: { id: true, vesselId: true, status: true },
      }),
      prisma.nonConformity.findMany({ where: { companyId, deletedAt: null }, select: { id: true, vesselId: true } }),
      prisma.pscInspection.findMany({ where: { companyId, deletedAt: null }, select: { id: true, vesselId: true } }),
      prisma.internalAudit.findMany({ where: { companyId, deletedAt: null }, select: { id: true, vesselId: true } }),
      prisma.externalAudit.findMany({ where: { companyId, deletedAt: null }, select: { id: true, vesselId: true } }),
      prisma.companyInspection.findMany({ where: { companyId, deletedAt: null }, select: { id: true, vesselId: true } }),
    ]);

  const pscInspectionIds = pscInspections.map((i) => i.id);
  const internalAuditIds = internalAudits.map((a) => a.id);
  const externalAuditIds = externalAudits.map((a) => a.id);
  const companyInspectionIds = companyInspections.map((c) => c.id);

  const [pscDeficiencies, internalAuditFindings, externalAuditFindings, companyInspectionObservations] =
    await Promise.all([
      pscInspectionIds.length
        ? prisma.pscDeficiency.findMany({ where: { companyId, inspectionId: { in: pscInspectionIds }, deletedAt: null }, select: { id: true, inspectionId: true } })
        : Promise.resolve([]),
      internalAuditIds.length
        ? prisma.internalAuditFinding.findMany({ where: { companyId, auditId: { in: internalAuditIds }, deletedAt: null }, select: { id: true, auditId: true } })
        : Promise.resolve([]),
      externalAuditIds.length
        ? prisma.externalAuditFinding.findMany({ where: { companyId, auditId: { in: externalAuditIds }, deletedAt: null }, select: { id: true, auditId: true } })
        : Promise.resolve([]),
      companyInspectionIds.length
        ? prisma.companyInspectionObservation.findMany({ where: { companyId, inspectionId: { in: companyInspectionIds }, deletedAt: null }, select: { id: true, inspectionId: true } })
        : Promise.resolve([]),
    ]);

  // vesselId lookups for the "one join-hop" entity types, via their parent.
  const pscInspectionVessel = new Map(pscInspections.map((i) => [i.id, i.vesselId]));
  const internalAuditVessel = new Map(internalAudits.map((a) => [a.id, a.vesselId]));
  const externalAuditVessel = new Map(externalAudits.map((a) => [a.id, a.vesselId]));
  const companyInspectionVessel = new Map(companyInspections.map((c) => [c.id, c.vesselId]));

  // entityId -> vesselId, across all 7 CAPA-adopting entity types.
  const entityVessel = new Map<string, string | null>();
  for (const r of incidents) entityVessel.set(`Incident:${r.id}`, r.vesselId);
  for (const r of nearMisses) entityVessel.set(`NearMiss:${r.id}`, r.vesselId);
  for (const r of ncrs) entityVessel.set(`NonConformity:${r.id}`, r.vesselId);
  for (const r of pscDeficiencies) entityVessel.set(`PscDeficiency:${r.id}`, pscInspectionVessel.get(r.inspectionId) ?? null);
  for (const r of internalAuditFindings) entityVessel.set(`InternalAuditFinding:${r.id}`, internalAuditVessel.get(r.auditId) ?? null);
  for (const r of externalAuditFindings) entityVessel.set(`ExternalAuditFinding:${r.id}`, externalAuditVessel.get(r.auditId) ?? null);
  for (const r of companyInspectionObservations) entityVessel.set(`CompanyInspectionObservation:${r.id}`, companyInspectionVessel.get(r.inspectionId) ?? null);

  const allEntityTypes = [
    "Incident",
    "NearMiss",
    "NonConformity",
    "PscDeficiency",
    "InternalAuditFinding",
    "ExternalAuditFinding",
    "CompanyInspectionObservation",
  ];
  const capaRows = await prisma.capaAction.findMany({
    where: { companyId, status: { not: "CLOSED" }, deletedAt: null, entityType: { in: allEntityTypes } },
    select: { entityType: true, entityId: true },
  });

  // Count distinct source items (observations/findings/incidents/etc.) that
  // still have at least one open CAPA action, not the raw CAPA action rows —
  // a single observation commonly carries both a corrective and a
  // preventive action, which would otherwise double-count one open item as
  // two. Grouped per vessel AND per originating module, so the Vessel
  // Health panel can show where the pending count actually comes from
  // (e.g. Company Inspection: 5, PSC: 2) instead of one opaque total.
  const pendingByVesselType = new Map<string, Map<string, Set<string>>>();
  for (const row of capaRows) {
    const entityKey = `${row.entityType}:${row.entityId}`;
    const vesselId = entityVessel.get(entityKey);
    if (!vesselId) continue;
    const byType = pendingByVesselType.get(vesselId) ?? new Map<string, Set<string>>();
    const set = byType.get(row.entityType) ?? new Set<string>();
    set.add(row.entityId);
    byType.set(row.entityType, set);
    pendingByVesselType.set(vesselId, byType);
  }
  const capaPendingByVessel = new Map<string, number>();
  const capaPendingTypeCountsByVessel = new Map<string, Map<string, number>>();
  for (const [vesselId, byType] of pendingByVesselType) {
    let total = 0;
    const typeCounts = new Map<string, number>();
    for (const [entityType, set] of byType) {
      total += set.size;
      typeCounts.set(entityType, set.size);
    }
    capaPendingByVessel.set(vesselId, total);
    capaPendingTypeCountsByVessel.set(vesselId, typeCounts);
  }

  const incidentsPendingByVessel = new Map<string, number>();
  for (const r of incidents) {
    if (!r.vesselId || !(OPEN_INCIDENT_STATUSES as readonly string[]).includes(r.status)) continue;
    incidentsPendingByVessel.set(r.vesselId, (incidentsPendingByVessel.get(r.vesselId) ?? 0) + 1);
  }

  // Open = still needs the office to review/close it out (REPORTED or
  // UNDER_REVIEW) — not a rolling reporting-volume count. DRAFT hasn't
  // reached the office yet; CLOSED is done.
  const nearMissOpenByVessel = new Map<string, number>();
  for (const r of nearMisses) {
    if (!r.vesselId || !(r.status === "REPORTED" || r.status === "UNDER_REVIEW")) continue;
    nearMissOpenByVessel.set(r.vesselId, (nearMissOpenByVessel.get(r.vesselId) ?? 0) + 1);
  }

  return { capaPendingByVessel, capaPendingTypeCountsByVessel, incidentsPendingByVessel, nearMissOpenByVessel };
}

export type VesselHealthReport = {
  vesselId: string;
  vesselName: string;
  // Distinct source items (Incident/NearMiss/NCR/PSC deficiency/audit
  // finding/inspection observation) still carrying at least one open CAPA —
  // not a raw CAPA action count, since one item often has both a corrective
  // and a preventive action open at once.
  capaPending: number;
  // Per-module breakdown of capaPending (e.g. "Company Inspection: 5, PSC:
  // 2, Incident: 1, External Audit: 1"), sorted by count descending; empty
  // when capaPending is 0.
  capaPendingByModule: CapaModuleBreakdown[];
  incidentsPendingInvestigation: number;
  // Still needs the office to review/close it out (REPORTED or
  // UNDER_REVIEW) — not a reporting-volume count.
  nearMissOpen: number;
  drillsOverdue: number;
  drillsTotal: number;
  documentsExpired: number;
  documentsExpiringSoon: number;
  meetingsPendingOfficeReply: number;
  meetingHeldThisMonth: boolean;
  drillsMissingThisMonth: string[];
  requisitionsPendingDelivery: number;
  lastDailyReportDate: Date | null;
  daysSinceLastDailyReport: number | null;
  sireSchedule: SireScheduleRow | null;
  internalAuditSchedule: InternalAuditScheduleRow | null;
};

/** Every vessel's health snapshot in one batch. Every underlying fetch is
 * company-wide (no vesselId filter) with grouping done in JS, so the query
 * count stays roughly constant (~20-ish) regardless of fleet size — the
 * Dashboard's Fleet Health table needs every vessel anyway, and the
 * single-vessel detail panel just picks its one row out of this same
 * result instead of running a second, largely-duplicate query pass. */
export async function getFleetVesselHealth(companyId: string): Promise<VesselHealthReport[]> {
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const month = now.getMonth();

  const [
    vessels,
    { capaPendingByVessel, capaPendingTypeCountsByVessel, incidentsPendingByVessel, nearMissOpenByVessel },
    sireScheduleRows,
    internalAuditScheduleRows,
    drillMatrixByVessel,
    documents,
    warningMonths,
    meetings,
    procurementStatus,
    lastEntries,
  ] = await Promise.all([
    prisma.vessel.findMany({
      where: { companyId, deletedAt: null, status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    computeFleetIncidentCapaSignals(companyId),
    listSireSchedule(companyId),
    listInternalAuditSchedule(companyId),
    buildFleetDrillMatrix(companyId, now.getFullYear()),
    prisma.vesselDocument.findMany({
      where: { companyId, deletedAt: null, vesselId: { not: null } },
      select: { vesselId: true, expiredDate: true, active: true },
    }),
    getExpiryWarningMonths(companyId),
    prisma.committeeMeeting.findMany({
      where: { companyId, deletedAt: null, vesselId: { not: null } },
      select: { vesselId: true, status: true, meetingDate: true },
    }),
    listFleetProcurementStatus(companyId),
    listFleetLastEntries(companyId),
  ]);

  const documentsByVessel = new Map<string, { expiredDate: Date | null; active: boolean }[]>();
  for (const d of documents) {
    if (!d.vesselId) continue;
    const arr = documentsByVessel.get(d.vesselId) ?? [];
    arr.push(d);
    documentsByVessel.set(d.vesselId, arr);
  }

  const meetingsPendingByVessel = new Map<string, number>();
  const meetingHeldThisMonthSet = new Set<string>();
  for (const m of meetings) {
    if (!m.vesselId) continue;
    if (m.status === "REPORTED") meetingsPendingByVessel.set(m.vesselId, (meetingsPendingByVessel.get(m.vesselId) ?? 0) + 1);
    if ((m.status === "REPORTED" || m.status === "CLOSED") && m.meetingDate >= monthStart && m.meetingDate <= monthEnd) {
      meetingHeldThisMonthSet.add(m.vesselId);
    }
  }

  const procurementByVessel = new Map(procurementStatus.map((p) => [p.vessel.id, p.pendingRequisitionCount]));
  const lastEntryByVessel = new Map(lastEntries.map((e) => [e.vessel.id, e.lastEntry]));

  return vessels.map((v) => {
    const drillMatrix = drillMatrixByVessel.get(v.id) ?? [];
    const drillsOverdue = drillMatrix.filter((row) => row.status === "red").length;
    const drillsTotal = drillMatrix.filter((row) => row.status !== "none").length;
    const drillsMissingThisMonth = drillMatrix
      .filter(
        (row) =>
          row.frequencyDays !== null &&
          row.frequencyDays <= MONTHLY_FREQUENCY_DAYS_MAX &&
          !row.notApplicable &&
          (row.monthEntries[month] ?? []).length === 0,
      )
      .map((row) => row.name);

    let documentsExpired = 0;
    let documentsExpiringSoon = 0;
    for (const doc of documentsByVessel.get(v.id) ?? []) {
      const warning = computeWarningStatus(doc.expiredDate, warningMonths, doc.active);
      if (warning === "expired") documentsExpired++;
      else if (warning === "warning") documentsExpiringSoon++;
    }

    const lastEntry = lastEntryByVessel.get(v.id) ?? null;
    const daysSinceLastDailyReport = lastEntry ? Math.floor((now.getTime() - lastEntry.date.getTime()) / dayMs) : null;

    const typeCounts = capaPendingTypeCountsByVessel.get(v.id);
    const capaPendingByModule: CapaModuleBreakdown[] = CAPA_ENTITY_TYPE_ORDER.map((entityType) => ({
      module: CAPA_ENTITY_TYPE_LABELS[entityType]!,
      count: typeCounts?.get(entityType) ?? 0,
    }));

    return {
      vesselId: v.id,
      vesselName: v.name,
      capaPending: capaPendingByVessel.get(v.id) ?? 0,
      capaPendingByModule,
      incidentsPendingInvestigation: incidentsPendingByVessel.get(v.id) ?? 0,
      nearMissOpen: nearMissOpenByVessel.get(v.id) ?? 0,
      drillsOverdue,
      drillsTotal,
      documentsExpired,
      documentsExpiringSoon,
      meetingsPendingOfficeReply: meetingsPendingByVessel.get(v.id) ?? 0,
      meetingHeldThisMonth: meetingHeldThisMonthSet.has(v.id),
      drillsMissingThisMonth,
      requisitionsPendingDelivery: procurementByVessel.get(v.id) ?? 0,
      lastDailyReportDate: lastEntry?.date ?? null,
      daysSinceLastDailyReport,
      sireSchedule: sireScheduleRows.find((r) => r.vesselId === v.id) ?? null,
      internalAuditSchedule: internalAuditScheduleRows.find((r) => r.vesselId === v.id) ?? null,
    };
  });
}

export async function listVesselOptions(companyId: string) {
  return prisma.vessel.findMany({
    where: { companyId, deletedAt: null, status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
