import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { requirePermission } from "@/lib/rbac";
import { listFleetLastEnvironmentEntries } from "@/features/environment/queries";
import { MONTH_NAMES } from "@/features/environment/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function EnvironmentFleetPage() {
  const user = await requirePermission("environment:read");
  // SHIPBOARD only ever sees their own vessel's row on this fleet dashboard
  // — never other vessels'. OFFICE stays unrestricted.
  const isShipboard = user.department === "SHIPBOARD";
  const vesselId = isShipboard ? (user.vesselId ?? "__no-vessel-assigned__") : undefined;
  const fleet = await listFleetLastEnvironmentEntries(user.companyId, vesselId);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Environment Records"
        description="Monthly garbage disposal and oil/water discharge reporting per vessel — feeds the environment KPI dashboard."
        actions={
          <Link href="/environment/kpi">
            <Button variant="warning"><BarChart3 className="h-4 w-4" /> Fleet KPI Dashboard</Button>
          </Link>
        }
      />

      <Card>
        <CardContent className="pt-5">
          <div className="mb-3 text-sm font-semibold">Fleet — {fleet.length} vessels</div>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Vessel</th>
                  <th className="px-3 py-2 font-medium">Last Record</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {fleet.map(({ vessel, lastEntry }) => (
                  <tr key={vessel.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">
                      <Link href={`/environment/${vessel.id}`} className="font-medium text-accent hover:underline">
                        {vessel.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {lastEntry ? `${MONTH_NAMES[lastEntry.month - 1]} ${lastEntry.year}` : "No records yet"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link href={`/environment/${vessel.id}`}>
                        <Button type="button" variant="outline" size="sm">
                          Go to Records
                        </Button>
                      </Link>
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
