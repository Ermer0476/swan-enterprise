import Link from "next/link";
import { ArrowLeft, Ruler } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { listUnitMasters } from "@/features/environment/queries";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { UnitMasterPanel } from "./unit-master-panel";

export default async function EnvironmentUnitMasterPage() {
  const user = await requirePermission("environment:read");
  const canManage = can(user, "environment:manage-units");

  const [sewageUnits, cargoUnits] = await Promise.all([
    listUnitMasters(user.companyId, "SEWAGE"),
    listUnitMasters(user.companyId, "CARGO"),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/environment" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Environment Records
      </Link>
      <PageHeader
        title="Environmental Unit Master"
        description="Controlled conversion factors behind the Sewage/Cargo Unit pickers on the monthly entry form. The crew only ever picks a unit — this is the one place the conversion factor itself is set."
      />

      {!canManage && (
        <Card className="mb-4 border-warning/40 bg-warning/10">
          <CardContent className="flex items-center gap-2 pt-5 text-sm">
            <Ruler className="h-4 w-4 shrink-0 text-warning" />
            You don&apos;t have permission to change these — contact an Administrator or QHSE Manager. Shown here read-only.
          </CardContent>
        </Card>
      )}

      <Card className="mb-4">
        <CardContent className="pt-5">
          {canManage ? (
            <UnitMasterPanel metric="SEWAGE" title="Sewage" standardUnit="m3" rows={sewageUnits} />
          ) : (
            <ReadOnlyTable title="Sewage" rows={sewageUnits} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          {canManage ? (
            <UnitMasterPanel metric="CARGO" title="Cargo" standardUnit="MT" rows={cargoUnits} />
          ) : (
            <ReadOnlyTable title="Cargo" rows={cargoUnits} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReadOnlyTable({ title, rows }: { title: string; rows: { id: string; unit: string; unitLabel: string; standardUnit: string; toStandardFactor: number; isDefault: boolean }[] }) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold">{title}</div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No units configured yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Unit</th>
                <th className="px-3 py-2 font-medium">Label</th>
                <th className="px-3 py-2 font-medium">Standard Unit</th>
                <th className="px-3 py-2 font-medium">Factor</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-mono text-xs">{r.unit}</td>
                  <td className="px-3 py-2">{r.unitLabel}{r.isDefault && <span className="ml-2 text-xs text-accent">(default)</span>}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.standardUnit}</td>
                  <td className="px-3 py-2 tabular-nums">× {r.toStandardFactor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
