import { requirePermission, can } from "@/lib/rbac";
import { listVessels } from "@/features/vessels/queries";
import { listSparesCatalogue } from "@/features/procurement/queries";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AddSparesItemForm } from "./add-spares-item-form";

export default async function SparesCataloguePage({ searchParams }: { searchParams: Promise<{ vesselId?: string }> }) {
  const user = await requirePermission("procurement:read");
  const sp = await searchParams;
  const vessels = await listVessels(user.companyId);
  const activeVessels = vessels.filter((v) => v.status === "ACTIVE");
  const vesselId = sp.vesselId || activeVessels[0]?.id;
  const canManage = can(user, "procurement:manage-catalogue");

  const items = vesselId ? await listSparesCatalogue(user.companyId, vesselId) : [];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Spares Catalogue" description="Per-vessel — identified by Maker + Equipment + Part No." />

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

      {canManage && vesselId && <AddSparesItemForm vesselId={vesselId} />}

      <Card>
        <CardContent className="pt-5">
          <div className="mb-3 text-sm font-semibold">{items.length} items</div>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Equipment</th>
                  <th className="px-3 py-2 font-medium">Maker</th>
                  <th className="px-3 py-2 font-medium">Part No.</th>
                  <th className="px-3 py-2 font-medium">Description</th>
                  <th className="px-3 py-2 font-medium">Location</th>
                  <th className="px-3 py-2 font-medium">Unit</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-medium">{item.equipmentName}</td>
                    <td className="px-3 py-2 text-muted-foreground">{item.makerName}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{item.partNo}</td>
                    <td className="px-3 py-2 text-muted-foreground">{item.description ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{item.location ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{item.unit}</td>
                    <td className="px-3 py-2">{item.criticalSpare && <Badge tone="danger">Critical Spare</Badge>}</td>
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
