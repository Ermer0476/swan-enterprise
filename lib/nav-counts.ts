import "server-only";
import { prisma } from "@/lib/prisma";
import { computeWarningStatus, getExpiryWarningMonths } from "@/features/vessel-documents/queries";

/** Sidebar badge counts, keyed by nav href. "Needs attention" = still open
 * (not closed/rectified) for the tracker modules, or a pending revision
 * request / an expiring-or-expired certificate for the others. Office users
 * see the fleet-wide count; shipboard users see only their own vessel's. */
export async function getNavCounts(
  companyId: string,
  vesselId: string | null,
): Promise<Record<string, number>> {
  const vesselFilter = vesselId ? { vesselId } : {};

  const [incidents, nearMiss, ncr, defects, riskPending, meetingsWaiting, sireOpen, iauditOpen, eauditOpen, flaginspOpen, cinspOpen, pscOpen, cdiOpen, vesselDocs, warningMonths] = await Promise.all([
    prisma.incident.count({
      where: { companyId, deletedAt: null, status: { not: "CLOSED" }, ...vesselFilter },
    }),
    prisma.nearMiss.count({
      where: { companyId, deletedAt: null, status: { not: "CLOSED" }, ...vesselFilter },
    }),
    prisma.nonConformity.count({
      where: { companyId, deletedAt: null, status: { not: "CLOSED" }, ...vesselFilter },
    }),
    prisma.defect.count({
      where: { companyId, deletedAt: null, status: { in: ["OPEN", "MONITORING"] }, ...vesselFilter },
    }),
    prisma.riskAssessmentRevisionRequest.count({
      where: { companyId, status: "PENDING", ...vesselFilter },
    }),
    prisma.committeeMeeting.count({
      where: { companyId, deletedAt: null, status: "REPORTED", ...vesselFilter },
    }),
    prisma.sireInspection.count({
      where: { companyId, deletedAt: null, status: { not: "CLOSED" }, ...vesselFilter },
    }),
    prisma.internalAudit.count({
      where: { companyId, deletedAt: null, status: { not: "CLOSED" }, ...vesselFilter },
    }),
    prisma.externalAudit.count({
      where: { companyId, deletedAt: null, status: { not: "CLOSED" }, ...vesselFilter },
    }),
    prisma.flagInspection.count({
      where: { companyId, deletedAt: null, status: { not: "CLOSED" }, ...vesselFilter },
    }),
    prisma.companyInspection.count({
      where: { companyId, deletedAt: null, status: { not: "CLOSED" }, ...vesselFilter },
    }),
    prisma.pscInspection.count({
      where: { companyId, deletedAt: null, status: { not: "CLOSED" }, ...vesselFilter },
    }),
    prisma.cdiInspection.count({
      where: { companyId, deletedAt: null, status: { not: "CLOSED" }, ...vesselFilter },
    }),
    prisma.vesselDocument.findMany({
      where: { companyId, deletedAt: null, active: true, ...vesselFilter },
      select: { expiredDate: true },
    }),
    getExpiryWarningMonths(companyId),
  ]);

  const docsWarning = vesselDocs.filter(
    (d) => computeWarningStatus(d.expiredDate, warningMonths, true) !== null,
  ).length;

  return {
    "/incidents": incidents,
    "/near-miss": nearMiss,
    "/non-conformities": ncr,
    "/defects": defects,
    "/risk": riskPending,
    "/meetings": meetingsWaiting,
    "/sire": sireOpen,
    "/internal-audits": iauditOpen,
    "/external-audits": eauditOpen,
    "/flag-inspections": flaginspOpen,
    "/company-inspections": cinspOpen,
    "/psc": pscOpen,
    "/cdi": cdiOpen,
    "/documents": docsWarning,
  };
}
