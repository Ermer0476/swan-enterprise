import Link from "next/link";
import { Plus, Ship, ChevronDown } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { listVessels, vesselHistoryByYear } from "@/features/vessels/queries";
import { humanize } from "@/features/vessels/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { YearBarChart } from "@/components/ui/bar-chart";

function statusTone(s: string) {
  return s === "ACTIVE" ? "success" : s === "SOLD" ? "neutral" : "warning";
}

function VesselTable({ rows }: { rows: Awaited<ReturnType<typeof listVessels>> }) {
  return (
    <table className="w-full text-sm">
      <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
        <tr>
          <th className="px-4 py-2.5 font-medium">Name</th>
          <th className="px-4 py-2.5 font-medium">Code</th>
          <th className="px-4 py-2.5 font-medium">IMO</th>
          <th className="px-4 py-2.5 font-medium">Type</th>
          <th className="px-4 py-2.5 font-medium">Flag</th>
          <th className="px-4 py-2.5 font-medium">Trade Area</th>
          <th className="px-4 py-2.5 font-medium">Head Owner</th>
          <th className="px-4 py-2.5 font-medium">Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((v) => (
          <tr key={v.id} className="border-b border-border last:border-0 hover:bg-muted/30">
            <td className="px-4 py-2.5">
              <Link href={`/vessels/${v.id}`} className="font-medium hover:underline">{v.name}</Link>
            </td>
            <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{v.code ?? "—"}</td>
            <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{v.imo ?? "—"}</td>
            <td className="px-4 py-2.5 text-muted-foreground">{v.type}</td>
            <td className="px-4 py-2.5 text-muted-foreground">{v.flag ?? "—"}</td>
            <td className="px-4 py-2.5 text-muted-foreground">{v.tradeArea ?? "—"}</td>
            <td className="px-4 py-2.5 text-muted-foreground">{v.headOwner ?? "—"}</td>
            <td className="px-4 py-2.5"><Badge tone={statusTone(v.status)}>{humanize(v.status)}</Badge></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function VesselsPage() {
  const user = await requirePermission("vessel:read");
  const [rows, { history, peakYear }] = await Promise.all([
    listVessels(user.companyId),
    vesselHistoryByYear(user.companyId),
  ]);
  const canCreate = can(user, "vessel:create");

  const active = rows.filter((v) => v.status !== "SOLD");
  const former = rows.filter((v) => v.status === "SOLD");

  const typeStats = [...new Set(rows.map((v) => v.type))]
    .map((t) => ({
      type: t,
      total: rows.filter((v) => v.type === t).length,
      active: rows.filter((v) => v.type === t && v.status !== "SOLD").length,
    }))
    .sort((a, b) => b.total - a.total);

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
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Card className="border-accent/40 bg-accent/5">
              <CardContent className="pt-4">
                <div className="text-2xl font-semibold tabular-nums text-accent">{active.length}</div>
                <div className="mt-0.5 text-xs font-medium text-accent">Active Vessels</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-semibold tabular-nums">{rows.length}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Total Managed — {active.length} active · {former.length} former
                </div>
              </CardContent>
            </Card>
            {typeStats.map((t) => (
              <Card key={t.type}>
                <CardContent className="pt-4">
                  <div className="text-2xl font-semibold tabular-nums">{t.total}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {t.type} — {t.active > 0 ? `${t.active} active` : "all former"}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {history.length > 1 && (
            <Card className="mb-6">
              <CardContent className="pt-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">Vessels Under Management by Year</div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {history[0]!.year}–{history[history.length - 1]!.year} · counts each vessel from its fleet
                      entry year through its exit (or today if still active).
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/40 px-2.5 py-1 text-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                    <span className="text-muted-foreground">Peak</span>
                    <span className="font-semibold text-warning">
                      {history.find((h) => h.year === peakYear)?.count ?? 0} vessels · {peakYear}
                    </span>
                  </span>
                </div>
                <YearBarChart
                  data={history.map((h) => ({ year: h.year, value: h.count }))}
                  peakYear={peakYear}
                />
              </CardContent>
            </Card>
          )}

          <Card className="mb-4 overflow-hidden">
            <div className="overflow-x-auto">
              <VesselTable rows={active} />
            </div>
          </Card>

          {former.length > 0 && (
            <details className="group rounded-lg border border-border bg-card text-card-foreground shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between p-4 [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2 text-sm font-medium">
                  Former Fleet
                  <Badge tone="neutral">{former.length}</Badge>
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="overflow-x-auto border-t border-border">
                <VesselTable rows={former} />
              </div>
            </details>
          )}
        </>
      )}
    </>
  );
}
