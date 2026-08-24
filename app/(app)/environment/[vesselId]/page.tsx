import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BarChart3, Plus } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { getVessel } from "@/features/vessels/queries";
import { listEnvironmentRecordsForVessel } from "@/features/environment/queries";
import { garbageTotals, sewageTotalDischarged, MONTH_NAMES } from "@/features/environment/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default async function EnvironmentVesselPage({
  params,
  searchParams,
}: {
  params: Promise<{ vesselId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("environment:read");
  const { vesselId } = await params;
  const sp = await searchParams;
  const vessel = await getVessel(user.companyId, vesselId);
  if (!vessel) notFound();

  const today = new Date();
  const year = Number(sp.year) || today.getUTCFullYear();
  const records = await listEnvironmentRecordsForVessel(user.companyId, vesselId, year);

  const isArchived = !!vessel.archivedAt;
  const ownVesselMatch = user.department !== "SHIPBOARD" || user.vesselId === vesselId;
  const canCreate = can(user, "environment:create") && ownVesselMatch && !isArchived;
  const canManage = can(user, "environment:update") && ownVesselMatch && !isArchived;

  const years = Array.from({ length: 4 }, (_, i) => today.getUTCFullYear() - i);

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/environment" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Fleet
      </Link>

      <PageHeader
        title={`${vessel.name} — Environment Records`}
        description="Monthly garbage disposal and oil/water discharge reporting."
        actions={
          <div className="flex gap-2">
            <Link href={`/environment/${vesselId}/kpi`}>
              <Button type="button" variant="outline">
                <BarChart3 className="h-4 w-4" /> KPI Dashboard
              </Button>
            </Link>
            {canCreate && (
              <Link href={`/environment/${vesselId}/new`}>
                <Button type="button">
                  <Plus className="h-4 w-4" /> Add This Month&apos;s Entry
                </Button>
              </Link>
            )}
          </div>
        }
      />

      {isArchived && <p className="mb-4 text-sm text-warning">This vessel is archived — its environment records are read-only.</p>}

      <form className="mb-4 flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Year</label>
          <Select name="year" defaultValue={String(year)} className="w-28">
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="outline">
          Apply
        </Button>
      </form>

      <Card>
        <CardContent className="pt-5">
          <div className="mb-3 text-sm font-semibold">
            {year} — {records.length} record{records.length === 1 ? "" : "s"}
          </div>
          {records.length === 0 ? (
            <p className="text-sm text-muted-foreground">No environment records logged for {year} yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Month</th>
                    <th className="px-3 py-2 font-medium">Total Garbage (cu.m.)</th>
                    <th className="px-3 py-2 font-medium">Ballast/Sewage/Grey Water (cu.m.)</th>
                    <th className="px-3 py-2 font-medium">Refrigerant (kg)</th>
                    <th className="px-3 py-2 font-medium">Cargo Loaded (mt)</th>
                    <th className="px-3 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => {
                    const totalGarbage = garbageTotals(r.garbageEntries).reduce((s, g) => s + g.totalCbm, 0);
                    const water =
                      (r.ballastWaterQuantity ?? 0) + (r.sewageQuantityNormalized ?? sewageTotalDischarged(r)) + (r.greyWaterDischarged ?? 0);
                    return (
                      <tr key={r.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 font-medium">{MONTH_NAMES[r.month - 1]}</td>
                        <td className="px-3 py-2 tabular-nums">{totalGarbage.toFixed(2)}</td>
                        <td className="px-3 py-2 tabular-nums">{water.toFixed(2)}</td>
                        <td className="px-3 py-2 tabular-nums">{r.refrigerantQuantityKg?.toFixed(2) ?? "—"}</td>
                        <td className="px-3 py-2 tabular-nums">{(r.cargoLoadedNormalized ?? r.cargoLoaded)?.toFixed(2) ?? "—"}</td>
                        <td className="px-3 py-2 text-right">
                          {canManage && (
                            <Link href={`/environment/${vesselId}/${r.id}/edit`}>
                              <Button type="button" variant="outline" size="sm">
                                Edit
                              </Button>
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
