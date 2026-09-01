import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/rbac";
import { getVessel } from "@/features/vessels/queries";
import {
  listStoresCatalogue,
  listSparesCatalogue,
  getRobMapByCondition,
  getCurrentPlacementMap,
  listKnownLocations,
  hasPostedOpeningStockTake,
  getOpenInventoryUpdateDraft,
} from "@/features/procurement/queries";
import {
  STORES_CATEGORY_LABELS,
  REQUISITION_DEPARTMENT_LABELS,
  INVENTORY_CONDITIONS,
  type InventoryConditionValue,
  type StoresCategoryValue,
  type RequisitionDepartmentValue,
} from "@/features/procurement/schema";
import { PageHeader } from "@/components/ui/page-header";
import { UpdateInventoryForm } from "./update-inventory-form";
import { AddSubCategoryForm } from "./add-sub-category-form";
import { SubGroupFilterSelect } from "./sub-group-filter-select";

type DeptTab = "DECK" | "ENGINE" | "SPARES";

export default async function UpdateInventoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ vesselId: string }>;
  searchParams: Promise<{ department?: string; category?: string; subGroup?: string }>;
}) {
  const user = await requirePermission("procurement:create");
  const { vesselId } = await params;
  const sp = await searchParams;
  const vessel = await getVessel(user.companyId, vesselId);
  if (!vessel) notFound();

  if (!(await hasPostedOpeningStockTake(user.companyId, vesselId))) {
    return (
      <div className="mx-auto max-w-3xl">
        <Link href={`/procurement/${vesselId}/inventory`} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          ← Back to Inventory Ledger
        </Link>
        <PageHeader title={`${vessel.name} — Update Inventory`} />
        <p className="text-sm text-warning">Post the Opening Stock Take before logging inventory movements.</p>
      </div>
    );
  }

  const activeDept: DeptTab = sp.department === "ENGINE" ? "ENGINE" : sp.department === "SPARES" ? "SPARES" : "DECK";
  const activeCategory = activeDept === "SPARES" ? null : ((sp.category as StoresCategoryValue | undefined) ?? null);
  const activeSubGroup = activeDept === "SPARES" ? null : (sp.subGroup ?? null);
  // The draft model only knows Deck/Engine (Spares has no department field of
  // its own) — same null-means-Spares convention used everywhere else.
  const draftDepartment: RequisitionDepartmentValue | null = activeDept === "SPARES" ? null : activeDept;

  const [storesItems, sparesItems, storesRob, sparesRob, storesPlacement, sparesPlacement, knownLocations, draft] = await Promise.all([
    activeDept === "SPARES" ? Promise.resolve([]) : listStoresCatalogue(user.companyId, vesselId),
    activeDept === "SPARES" ? listSparesCatalogue(user.companyId, vesselId) : Promise.resolve([]),
    activeDept === "SPARES" ? Promise.resolve(new Map<string, number>()) : getRobMapByCondition(user.companyId, vesselId, "STORES"),
    activeDept === "SPARES" ? getRobMapByCondition(user.companyId, vesselId, "SPARES") : Promise.resolve(new Map<string, number>()),
    activeDept === "SPARES"
      ? Promise.resolve(new Map<string, { location: string; remarks: string }>())
      : getCurrentPlacementMap(user.companyId, vesselId, "STORES"),
    activeDept === "SPARES"
      ? getCurrentPlacementMap(user.companyId, vesselId, "SPARES")
      : Promise.resolve(new Map<string, { location: string; remarks: string }>()),
    listKnownLocations(user.companyId, vesselId),
    getOpenInventoryUpdateDraft(user.companyId, vesselId, draftDepartment, activeCategory),
  ]);

  type Row = {
    itemType: "STORES" | "SPARES";
    itemId: string;
    label: string;
    unit: string;
    // Per-condition, not a single lumped figure — the grid lets the crew
    // pick New/Usable/Reconditioned per row, and the recount they type has
    // to be compared against that same condition's own running balance.
    robByCondition: Record<InventoryConditionValue, number>;
    currentLocation: string;
    currentRemarks: string;
    // Spares has no category of its own — Stores rows carry theirs so the
    // grid can offer an inline fix when an item's filed wrong.
    category: StoresCategoryValue | null;
    subGroup: string | null;
    groupLabel: string;
  };

  function robByConditionFor(map: Map<string, number>, itemId: string): Record<InventoryConditionValue, number> {
    const out = {} as Record<InventoryConditionValue, number>;
    for (const c of INVENTORY_CONDITIONS) out[c] = map.get(`${itemId}:${c}`) ?? 0;
    return out;
  }

  const rows: Row[] =
    activeDept === "SPARES"
      ? sparesItems.map((i) => ({
          itemType: "SPARES" as const,
          itemId: i.id,
          label: `${i.equipmentName} — ${i.makerName} ${i.partNo}`,
          unit: i.unit,
          robByCondition: robByConditionFor(sparesRob, i.id),
          // Falls back to the catalogue's own location for an item with no
          // ledger event yet (e.g. added after the opening count).
          currentLocation: sparesPlacement.get(i.id)?.location ?? i.location ?? "",
          currentRemarks: sparesPlacement.get(i.id)?.remarks ?? "",
          category: null,
          subGroup: null,
          groupLabel: i.location ?? "Unassigned Location",
        }))
      : storesItems
          .filter(
            (i) =>
              i.department === activeDept &&
              (!activeCategory || i.category === activeCategory) &&
              (!activeSubGroup || i.subGroup === activeSubGroup),
          )
          .map((i) => ({
            itemType: "STORES" as const,
            itemId: i.id,
            label: i.name,
            unit: i.unit,
            robByCondition: robByConditionFor(storesRob, i.id),
            currentLocation: storesPlacement.get(i.id)?.location ?? "",
            currentRemarks: storesPlacement.get(i.id)?.remarks ?? "",
            category: i.category,
            subGroup: i.subGroup,
            // Same "Category — Sub Category" grouping as Opening Stock Take —
            // some categories (IMO Stickers, say) run to well over a hundred
            // items, and Sub Category is how the real inventory sheets break
            // those up into something scannable.
            groupLabel: `${STORES_CATEGORY_LABELS[i.category]}${i.subGroup ? ` — ${i.subGroup}` : ""}`,
          }));

  // Every distinct Sub Category within the current Department + Category —
  // feeds the header's "All Sub Category" filter dropdown, which should only
  // offer sub-categories that actually exist in what's already showing.
  const subGroupsInScope =
    activeDept === "SPARES"
      ? []
      : Array.from(
          new Set(
            storesItems
              .filter((i) => i.department === activeDept && (!activeCategory || i.category === activeCategory))
              .map((i) => i.subGroup)
              .filter((s): s is string => !!s),
          ),
        ).sort();

  const backHref = `/procurement/${vesselId}/inventory?department=${activeDept}${activeCategory ? `&category=${activeCategory}` : ""}`;
  const scopeLabel = activeDept === "SPARES" ? "Spares" : `${REQUISITION_DEPARTMENT_LABELS[activeDept]}${activeCategory ? ` · ${STORES_CATEGORY_LABELS[activeCategory]}` : ""}${activeSubGroup ? ` · ${activeSubGroup}` : ""}`;

  return (
    <div className="mx-auto max-w-5xl">
      <Link href={backHref} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        ← Back to Inventory Ledger
      </Link>
      <PageHeader title={`${vessel.name} — Update Inventory`} description={scopeLabel} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {draftDepartment && <AddSubCategoryForm vesselId={vesselId} department={draftDepartment} category={activeCategory} />}
        {subGroupsInScope.length > 0 && (
          <SubGroupFilterSelect vesselId={vesselId} department={activeDept} category={activeCategory} current={activeSubGroup} subGroups={subGroupsInScope} />
        )}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No items in this selection yet — add one above.</p>
      ) : (
        <UpdateInventoryForm
          vesselId={vesselId}
          department={draftDepartment}
          category={activeCategory}
          rows={rows}
          knownLocations={knownLocations}
          backHref={backHref}
          draft={
            draft
              ? {
                  id: draft.id,
                  occurredAt: draft.occurredAt.toISOString().slice(0, 10),
                  updatedAt: draft.updatedAt,
                  lines: draft.linesJson as {
                    itemType: "STORES" | "SPARES";
                    itemId: string;
                    condition: "NEW" | "USABLE" | "RECONDITIONED";
                    quantity: number | null;
                    reason?: string;
                    location?: string;
                    remarks?: string;
                  }[],
                }
              : null
          }
        />
      )}
    </div>
  );
}
