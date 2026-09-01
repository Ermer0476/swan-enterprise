import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/rbac";
import { getVessel } from "@/features/vessels/queries";
import { listInventoryLedger, listStoresCatalogue, listSparesCatalogue, hasPostedOpeningStockTake } from "@/features/procurement/queries";
import {
  STORES_CATEGORIES_BY_DEPARTMENT,
  STORES_CATEGORY_LABELS,
  REQUISITION_DEPARTMENT_LABELS,
  INVENTORY_CONDITION_LABELS,
  type RequisitionDepartmentValue,
  type StoresCategoryValue,
} from "@/features/procurement/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CategorySelect } from "./category-select";
import { InventoryEventsTable, type EventRow } from "./events-table";

const EVENT_TONE: Record<string, "success" | "danger" | "warning" | "accent"> = {
  OPENING: "accent",
  RECEIVED: "success",
  ISSUED: "danger",
  ADJUSTMENT: "warning",
};

type DeptTab = "DECK" | "ENGINE" | "SPARES";
const DEPT_TABS: DeptTab[] = ["DECK", "ENGINE", "SPARES"];

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors ${
        active ? "bg-primary text-primary-foreground ring-primary" : "bg-card text-muted-foreground ring-border hover:bg-muted"
      }`}
    >
      {children}
    </Link>
  );
}

export default async function InventoryLedgerPage({
  params,
  searchParams,
}: {
  params: Promise<{ vesselId: string }>;
  searchParams: Promise<{ department?: string; category?: string }>;
}) {
  const user = await requirePermission("procurement:read");
  const { vesselId } = await params;
  const sp = await searchParams;
  const vessel = await getVessel(user.companyId, vesselId);
  if (!vessel) notFound();

  const gated = !(await hasPostedOpeningStockTake(user.companyId, vesselId));

  const [events, storesItems, sparesItems] = await Promise.all([
    listInventoryLedger(user.companyId, vesselId),
    listStoresCatalogue(user.companyId, vesselId),
    listSparesCatalogue(user.companyId, vesselId),
  ]);

  type ItemMeta = {
    label: string;
    unit: string;
    department: RequisitionDepartmentValue | null;
    category: StoresCategoryValue | null;
    subGroup: string | null;
  };
  const labelByKey = new Map<string, ItemMeta>();
  for (const i of storesItems) {
    labelByKey.set(`STORES:${i.id}`, { label: i.name, unit: i.unit, department: i.department, category: i.category, subGroup: i.subGroup });
  }
  for (const i of sparesItems) {
    labelByKey.set(`SPARES:${i.id}`, { label: `${i.equipmentName} — ${i.makerName} ${i.partNo}`, unit: i.unit, department: null, category: null, subGroup: null });
  }

  // Deck / Engine / Spares tabs — Spares carries no department (per the
  // catalogue's own scope), so it gets its own tab rather than being folded
  // into Deck or Engine. Defaults to Deck so the page isn't empty on load.
  const activeDept: DeptTab = sp.department === "ENGINE" ? "ENGINE" : sp.department === "SPARES" ? "SPARES" : "DECK";
  const activeCategory = activeDept === "SPARES" ? null : ((sp.category as StoresCategoryValue | undefined) ?? null);

  // Department-scoped, not the full static list — Engine only ever deals in
  // Engine Store/Chemicals/Tools, everything else is Deck-side (real fleet
  // practice, not derived from whatever items happen to exist yet — a
  // category with no items still gets a chip until something's filed there).
  const categoriesForDept = activeDept === "SPARES" ? [] : STORES_CATEGORIES_BY_DEPARTMENT[activeDept];

  function itemMatchesFilter(meta: ItemMeta | undefined): boolean {
    if (!meta) return false;
    if (activeDept === "SPARES") return meta.department === null;
    if (meta.department !== activeDept) return false;
    if (activeCategory && meta.category !== activeCategory) return false;
    return true;
  }

  const filteredEvents = events.filter((e) => itemMatchesFilter(labelByKey.get(`${e.itemType}:${e.itemId}`)));

  // Running ROB is computed over each item's FULL history (not the filtered
  // slice) — narrowing by department/category only changes which rows show,
  // never the balance math itself.
  const chronological = [...events].reverse();
  const running = new Map<string, number>();
  const robByEventId = new Map<string, number>();
  for (const e of chronological) {
    const key = `${e.itemType}:${e.itemId}:${e.condition}`;
    const next = (running.get(key) ?? 0) + e.quantity;
    running.set(key, next);
    robByEventId.set(e.id, next);
  }

  const eventRows: EventRow[] = filteredEvents.map((e) => {
    const meta = labelByKey.get(`${e.itemType}:${e.itemId}`);
    return {
      id: e.id,
      occurredAtMs: e.occurredAt.getTime(),
      dateLabel: e.occurredAt.toLocaleDateString(),
      itemLabel: meta?.label ?? "Unknown item",
      categoryLabel: meta?.category ? STORES_CATEGORY_LABELS[meta.category] : "—",
      subGroupLabel: meta?.subGroup ?? "—",
      locationLabel: e.location ?? "—",
      remarksLabel: e.remarks ?? "—",
      eventType: e.eventType,
      eventTone: EVENT_TONE[e.eventType] ?? "neutral",
      conditionLabel: INVENTORY_CONDITION_LABELS[e.condition],
      qtyLabel: `${e.quantity > 0 ? "+" : ""}${e.quantity}${meta ? ` ${meta.unit}` : ""}`,
      robLabel: String(robByEventId.get(e.id) ?? "—"),
      reasonLabel: e.reason ?? "—",
    };
  });

  const deptHref = (dept: DeptTab) => `/procurement/${vesselId}/inventory?department=${dept}`;
  const updateHref = `/procurement/${vesselId}/inventory/update?department=${activeDept}${activeCategory ? `&category=${activeCategory}` : ""}`;

  return (
    <div className="mx-auto max-w-6xl">
      <Link href={`/procurement/${vesselId}`} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        ← Back to {vessel.name}
      </Link>
      <PageHeader title={`${vessel.name} — Inventory Ledger`} description="Append-only event log. ROB is always computed, never stored." />

      <div className="mb-3 flex flex-wrap gap-2">
        {DEPT_TABS.map((dept) => (
          <Chip key={dept} href={deptHref(dept)} active={activeDept === dept}>
            {dept === "SPARES" ? "Spares" : REQUISITION_DEPARTMENT_LABELS[dept]}
          </Chip>
        ))}
      </div>

      {categoriesForDept.length > 0 && (
        <div className="mb-4">
          <CategorySelect vesselId={vesselId} department={activeDept} current={activeCategory} categories={categoriesForDept} />
        </div>
      )}

      {gated && <p className="mb-4 text-sm text-warning">Post the Opening Stock Take before logging inventory movements.</p>}
      {!gated && can(user, "procurement:create") && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Link href={updateHref}>
            <Button type="button">Update Inventory</Button>
          </Link>
          <Link href={`/procurement/${vesselId}/inventory/import`}>
            <Button type="button" variant="success">
              Import from Excel
            </Button>
          </Link>
        </div>
      )}

      <Card>
        <CardContent className="pt-5">
          <div className="mb-3 text-sm font-semibold">{filteredEvents.length} events</div>
          {filteredEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events for this selection yet.</p>
          ) : (
            <InventoryEventsTable rows={eventRows} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
