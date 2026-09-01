import { requirePermission, can } from "@/lib/rbac";
import { listVessels } from "@/features/vessels/queries";
import { listStoresCatalogue } from "@/features/procurement/queries";
import { STORES_CATEGORY_LABELS, REQUISITION_DEPARTMENT_LABELS } from "@/features/procurement/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AddStoresItemForm } from "./add-stores-item-form";
import { EditableImpaCell } from "./editable-impa-cell";
import { EditableDepartmentCell } from "./editable-department-cell";

export default async function StoresCataloguePage({ searchParams }: { searchParams: Promise<{ vesselId?: string }> }) {
  const user = await requirePermission("procurement:read");
  const sp = await searchParams;
  const vessels = await listVessels(user.companyId);
  const activeVessels = vessels.filter((v) => v.status === "ACTIVE");
  const vesselId = sp.vesselId || activeVessels[0]?.id;
  const canManage = can(user, "procurement:manage-catalogue");

  const items = vesselId ? await listStoresCatalogue(user.companyId, vesselId) : [];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Stores Catalogue" description="Per-vessel — each ship keeps its own catalogue." />

      <form className="mb-4 flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Vessel</label>
          <Select name="vesselId" defaultValue={vesselId} className="w-56">
            {activeVessels.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="outline">
          Apply
        </Button>
      </form>

      {canManage && vesselId && <AddStoresItemForm vesselId={vesselId} />}

      <Card>
        <CardContent className="pt-5">
          <div className="mb-3 text-sm font-semibold">{items.length} items</div>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Department</th>
                  <th className="px-3 py-2 font-medium">Category</th>
                  <th className="px-3 py-2 font-medium">Sub Category</th>
                  <th className="px-3 py-2 font-medium">Unit</th>
                  <th className="px-3 py-2 font-medium">IMPA</th>
                  <th className="px-3 py-2 font-medium">Flags</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-medium">{item.name}</td>
                    <td className="px-3 py-2">
                      {canManage ? (
                        <EditableDepartmentCell itemId={item.id} department={item.department} />
                      ) : (
                        <Badge tone={item.department === "ENGINE" ? "accent" : "neutral"}>{REQUISITION_DEPARTMENT_LABELS[item.department]}</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{STORES_CATEGORY_LABELS[item.category]}</td>
                    <td className="px-3 py-2 text-muted-foreground">{item.subGroup ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{item.unit}</td>
                    <td className="px-3 py-2">
                      {canManage ? <EditableImpaCell itemId={item.id} impaCode={item.impaCode} /> : <span className="font-mono text-xs text-muted-foreground">{item.impaCode ?? "—"}</span>}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {item.medicalChestCompliance && <Badge tone="accent">Medical Chest</Badge>}
                        {item.requiresExpiryTracking && <Badge tone="warning">Expiry Tracked</Badge>}
                        {item.imoHazardClass && <Badge tone="danger">IMO Class {item.imoHazardClass}</Badge>}
                        {item.shelfLifeMonths && <Badge tone="neutral">{item.shelfLifeMonths}mo shelf life</Badge>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
