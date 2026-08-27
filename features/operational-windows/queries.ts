import { prisma } from "@/lib/prisma";

// Defaults match the constants these settings replaced (see the Company model
// and the incident/SIRE/internal-audit schedule queries). Used when the company
// row predates the columns / a value is somehow null.
export const DEFAULT_OPERATIONAL_WINDOWS = {
  incidentOverdueDays: 30,
  sireDueSoonDays: 30,
  internalAuditDueSoonDays: 30,
} as const;

export type OperationalWindows = {
  incidentOverdueDays: number;
  sireDueSoonDays: number;
  internalAuditDueSoonDays: number;
};

/** The company's operational timing windows (days), with literal fallbacks. */
export async function getOperationalWindows(companyId: string): Promise<OperationalWindows> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      incidentOverdueDays: true,
      sireDueSoonDays: true,
      internalAuditDueSoonDays: true,
    },
  });
  return {
    incidentOverdueDays: company?.incidentOverdueDays ?? DEFAULT_OPERATIONAL_WINDOWS.incidentOverdueDays,
    sireDueSoonDays: company?.sireDueSoonDays ?? DEFAULT_OPERATIONAL_WINDOWS.sireDueSoonDays,
    internalAuditDueSoonDays:
      company?.internalAuditDueSoonDays ?? DEFAULT_OPERATIONAL_WINDOWS.internalAuditDueSoonDays,
  };
}
