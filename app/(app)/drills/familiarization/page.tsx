import Link from "next/link";
import { ArrowLeft, Plus, ClipboardCheck, LayoutGrid } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { listFamiliarizationSessions } from "@/features/familiarization/queries";
import { listVesselOptions } from "@/features/drills/queries";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export default async function FamiliarizationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("drill:read");
  const sp = await searchParams;
  const isShipboard = user.department === "SHIPBOARD";
  const vesselId = isShipboard ? (user.vesselId ?? undefined) : sp.vesselId || undefined;

  const [rows, vessels] = await Promise.all([
    listFamiliarizationSessions(user.companyId, { vesselId, search: sp.q || undefined }),
    listVesselOptions(user.companyId),
  ]);
  const canCreate = can(user, "drill:create");

  return (
    <div className="mx-auto max-w-7xl">
      <Link href="/drills" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Emergency Drills
      </Link>

      <PageHeader
        title="Familiarization (CK-047(b))"
        description="Familiarization sessions on the SMS management plans — each logged session is one record, in the same format as a drill."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/drills/matrix?tab=familiarization">
              <Button variant="outline"><LayoutGrid className="h-4 w-4" /> Familiarization Matrix</Button>
            </Link>
            {canCreate && vesselId && (
              <Link href={`/drills/matrix/log-familiarization?vesselId=${vesselId}`}>
                <Button><Plus className="h-4 w-4" /> Log Familiarization</Button>
              </Link>
            )}
          </div>
        }
      />

      <form className="mb-4 flex flex-wrap items-end gap-2">
        <div className="min-w-52 flex-1">
          <Input name="q" placeholder="Search by ref or noted-by…" defaultValue={sp.q ?? ""} />
        </div>
        {!isShipboard && (
          <Select name="vesselId" defaultValue={sp.vesselId ?? ""} className="w-56">
            <option value="">All vessels</option>
            {vessels.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </Select>
        )}
        <Button type="submit" variant="outline">Filter</Button>
      </form>

      {rows.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <ClipboardCheck className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No familiarization logged</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Log a familiarization session from the matrix — pick the vessel, then tick the topics covered.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Ref</th>
                  <th className="px-4 py-2.5 font-medium">Noted by</th>
                  <th className="px-4 py-2.5 font-medium">Vessel</th>
                  <th className="px-4 py-2.5 font-medium">Topics</th>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-mono text-xs">
                      <Link href={`/drills/familiarization/${r.id}`} className="text-accent hover:underline">{r.refNo}</Link>
                    </td>
                    <td className="max-w-xs truncate px-4 py-2.5">
                      <Link href={`/drills/familiarization/${r.id}`} className="hover:underline">{r.notedBy ?? "—"}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.vessel.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{r._count.records}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatDate(r.sessionDate)}</td>
                    <td className="px-4 py-2.5"><Badge tone="success">Logged</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
