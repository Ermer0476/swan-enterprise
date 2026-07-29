import Link from "next/link";
import { Plus, Ship } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { listVessels } from "@/features/vessels/queries";
import { humanize } from "@/features/vessels/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function statusTone(s: string) {
  return s === "ACTIVE" ? "success" : s === "SOLD" ? "neutral" : "warning";
}

export default async function VesselsPage() {
  const user = await requirePermission("vessel:read");
  const rows = await listVessels(user.companyId);
  const canCreate = can(user, "vessel:create");

  return (
    <>
      <PageHeader
        title="Vessels"
        description="Fleet particulars — the single source of truth referenced across every safety module."
        actions={
          canCreate ? (
            <Link href="/vessels/new">
              <Button><Plus className="h-4 w-4" /> Add Vessel</Button>
            </Link>
          ) : undefined
        }
      />

      {rows.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <Ship className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No vessels yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {canCreate ? "Add the fleet's particulars once here — every module reuses it." : "No vessels have been added yet."}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">IMO</th>
                  <th className="px-4 py-2.5 font-medium">Call Sign</th>
                  <th className="px-4 py-2.5 font-medium">Flag</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => (
                  <tr key={v.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2.5">
                      <Link href={`/vessels/${v.id}`} className="font-medium hover:underline">{v.name}</Link>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{v.imo}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{v.callSign ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{v.flag ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{v.type}</td>
                    <td className="px-4 py-2.5"><Badge tone={statusTone(v.status)}>{humanize(v.status)}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
