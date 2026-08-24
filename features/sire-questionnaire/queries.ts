import "server-only";
import { prisma } from "@/lib/prisma";

export async function listQuestionnaireVersions(companyId: string) {
  return prisma.sireQuestionnaireVersion.findMany({
    where: { companyId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

export type QuestionnaireSuggestItem = {
  chapter: number;
  no: string;
  question: string;
  shortText: string | null;
};

/** The current active version's items, trimmed to just what the suggestion
 * UI needs — not personInCharge/smsProcRefs, which the office reference view
 * shows but a shipboard-facing suggestion hint doesn't. */
export async function getActiveQuestionnaireItems(companyId: string): Promise<QuestionnaireSuggestItem[]> {
  const version = await prisma.sireQuestionnaireVersion.findFirst({
    where: { companyId, isActive: true, deletedAt: null },
    select: { id: true },
  });
  if (!version) return [];
  return prisma.sireQuestionnaireItem.findMany({
    where: { companyId, versionId: version.id },
    select: { chapter: true, no: true, question: true, shortText: true },
    orderBy: { no: "asc" },
  });
}
