import "server-only";
import { prisma } from "@/lib/prisma";
import type { ReferenceListKey } from "@/lib/reference-registry";

export type ReferenceListItemRow = {
  id: string;
  value: string;
  label: string;
  sortOrder: number;
  active: boolean;
  isSystem: boolean;
};

/** Every managed option for one company's reference list — including inactive
 * ones, so the office can reactivate a hidden option. Excludes soft-deleted
 * rows. Ordered the same way the picker reads them (sortOrder, then value).
 * This is the admin-page view; the picker itself uses lib/reference-list.ts. */
export async function listReferenceListItems(
  companyId: string,
  listKey: ReferenceListKey,
): Promise<ReferenceListItemRow[]> {
  return prisma.referenceListItem.findMany({
    where: { companyId, listKey, deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { value: "asc" }],
    select: { id: true, value: true, label: true, sortOrder: true, active: true, isSystem: true },
  });
}
