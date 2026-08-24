import "server-only";
import { prisma } from "@/lib/prisma";

export type DocumentWarningStatus = "expired" | "warning" | null;

/** Expired = past due; warning = expiring within the company's configured
 * lookahead window; null = no expiry date, or the document isn't active. */
export function computeWarningStatus(
  expiredDate: Date | null,
  warningMonths: number,
  active: boolean,
): DocumentWarningStatus {
  if (!active || !expiredDate) return null;
  const now = new Date();
  if (expiredDate.getTime() < now.getTime()) return "expired";
  const warnBy = new Date(now);
  warnBy.setMonth(warnBy.getMonth() + warningMonths);
  if (expiredDate.getTime() <= warnBy.getTime()) return "warning";
  return null;
}

export async function getExpiryWarningMonths(companyId: string): Promise<number> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { documentExpiryWarningMonths: true },
  });
  return company?.documentExpiryWarningMonths ?? 3;
}

export type VesselDocumentFilters = {
  origin: "VESSEL" | "COMPANY";
  vesselId?: string;
  type?: string;
  search?: string;
};

// Not paginated on purpose — this is a bounded per-vessel certificate
// register (~10 document types), not a growing chronological log, and the
// caller computes accurate expiring/expired counts from the full result set.
export async function listVesselDocuments(companyId: string, filters: VesselDocumentFilters) {
  return prisma.vesselDocument.findMany({
    where: {
      companyId,
      deletedAt: null,
      vesselId: filters.origin === "COMPANY" ? null : filters.vesselId || undefined,
      type: filters.type || undefined,
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: "insensitive" } },
              { certNo: { contains: filters.search, mode: "insensitive" } },
              { issuingBody: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { vessel: { select: { name: true } } },
    orderBy: [{ type: "asc" }, { refNo: "asc" }, { name: "asc" }],
  });
}

export async function getVesselDocument(companyId: string, id: string) {
  return prisma.vesselDocument.findFirst({
    where: { id, companyId, deletedAt: null },
    include: { vessel: { select: { name: true } } },
  });
}

/** Distinct types already used for Company Documents — there's no fixed
 * catalog for these (unlike VESSEL_DOCUMENT_TYPES), so the filter dropdown
 * is built from whatever's actually on file. */
export async function listCompanyDocumentTypes(companyId: string): Promise<string[]> {
  const rows = await prisma.vesselDocument.findMany({
    where: { companyId, deletedAt: null, vesselId: null },
    select: { type: true },
    distinct: ["type"],
    orderBy: { type: "asc" },
  });
  return rows.map((r) => r.type);
}

export type DocumentNameSuggestion = { name: string; refNo: string | null };

/** Documents names already on file for each Vessel Documentation type, e.g.
 * "Flag Certificates" -> ["Certificate of Ships Registry", ...], each paired
 * with the Ref it's already known by — company-wide, not per-vessel, so
 * picking a suggested name also carries over its established reference
 * number rather than leaving every vessel to invent its own. Feeds the
 * Document/Certificate Name suggestion list once a Type is picked; grows on
 * its own as more certificates get filed, no separate catalog table. */
export async function listVesselDocumentNamesByType(
  companyId: string,
): Promise<Record<string, DocumentNameSuggestion[]>> {
  const rows = await prisma.vesselDocument.findMany({
    where: { companyId, deletedAt: null, vesselId: { not: null } },
    select: { type: true, name: true, refNo: true },
    orderBy: { name: "asc" },
  });
  const byKey = new Map<string, DocumentNameSuggestion>();
  for (const row of rows) {
    const key = `${row.type}|||${row.name}`;
    const existing = byKey.get(key);
    // Prefer a row that actually has a Ref on file over one that doesn't,
    // regardless of which came first.
    if (!existing || (!existing.refNo && row.refNo)) {
      byKey.set(key, { name: row.name, refNo: row.refNo });
    }
  }
  const byType: Record<string, DocumentNameSuggestion[]> = {};
  for (const [key, suggestion] of byKey) {
    const type = key.split("|||")[0]!;
    (byType[type] ??= []).push(suggestion);
  }
  return byType;
}

export async function listVesselOptions(companyId: string) {
  return prisma.vessel.findMany({
    where: { companyId, deletedAt: null, status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
