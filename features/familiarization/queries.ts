import "server-only";
import { prisma } from "@/lib/prisma";

export async function listFamiliarizationSessions(
  companyId: string,
  filters: { vesselId?: string; search?: string } = {},
) {
  return prisma.familiarizationSession.findMany({
    where: {
      companyId,
      deletedAt: null,
      vesselId: filters.vesselId,
      ...(filters.search
        ? {
            OR: [
              { refNo: { contains: filters.search, mode: "insensitive" } },
              { notedBy: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      vessel: { select: { name: true } },
      _count: { select: { records: true } },
    },
    orderBy: { sessionDate: "desc" },
  });
}

export async function getFamiliarizationSession(companyId: string, id: string) {
  return prisma.familiarizationSession.findFirst({
    where: { id, companyId, deletedAt: null },
    include: { vessel: { select: { name: true } } },
  });
}

export type FamiliarizationTopic = {
  id: string;
  itemNo: string | null;
  name: string;
  completedDate: Date;
};

/** The SMS topics (schedule items) covered in one familiarization session — for
 * the read-only record detail + printable report. */
export async function getFamiliarizationSessionTopics(
  companyId: string,
  sessionId: string,
): Promise<FamiliarizationTopic[]> {
  const records = await prisma.familiarizationRecord.findMany({
    where: { companyId, familiarizationSessionId: sessionId, deletedAt: null },
    orderBy: { scheduleItem: { sortOrder: "asc" } },
    select: {
      completedDate: true,
      scheduleItem: { select: { id: true, itemNo: true, name: true } },
    },
  });
  return records.map((r) => ({
    id: r.scheduleItem.id,
    itemNo: r.scheduleItem.itemNo,
    name: r.scheduleItem.name,
    completedDate: r.completedDate,
  }));
}
