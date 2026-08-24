import Link from "next/link";
import { Plus, ClipboardList, Library, ChevronLeft, ChevronRight } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { listAllExecutions, executionKpis, listVesselOptions } from "@/features/risk/queries";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { formatDate, humanize } from "@/lib/utils";

export default async function RiskExecutionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("risk-doc:read");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  // SHIPBOARD users only ever see their own vessel's job executions — the
  // vessel filter is forced server-side regardless of what's in the URL, so
  // a shipboard user can't see the fleet by tampering with ?vesselId=.
  const isShipboard = user.department === "SHIPBOARD";
  const vesselIdFilter = isShipboard
    ? (user.vesselId ?? "__no-vessel-assigned__")
    : sp.vesselId || undefined;
  const [{ rows: executions, total, totalPages }, vessels] = await Promise.all([
    listAllExecutions(
      user.companyId,
      { search: sp.q || undefined, vesselId: vesselIdFilter },
      page,
    ),
    listVesselOptions(user.companyId),
  ]);
  const canExecute = can(user, "risk-doc:execute");
  const canCreate = can(user, "risk-doc:create");
  const kpis = canCreate ? await executionKpis(user.companyId) : null;

  // Preserves the current filters (q/vesselId) while only changing the page
  // number — so Prev/Next never silently drops a search or vessel filter.
  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (sp.q) params.set("q", sp.q);
    if (sp.vesselId) params.set("vesselId", sp.vesselId);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/risk?${qs}` : "/risk";
  };

  return (
    <>
      <PageHeader
        title="Risk Assessments"
        description="Job executions — every time an approved Risk Assessment was used onboard for a specific job."
        actions={
          canExecute ? (
            <Link href="/risk/library">
              <Button><Plus className="h-4 w-4" /> Create Job</Button>
            </Link>
          ) : undefined
        }
      />

      <div className="mb-4 flex justify-end">
        <Link href="/risk/library" className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline">
          <Library className="h-4 w-4" /> View Risk Assessment Library
        </Link>
      </div>

      {kpis && (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-semibold tabular-nums">{kpis.totalThisMonth}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">Executions This Month</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-semibold tabular-nums">{kpis.activeVessels}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">Active Vessels</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className={`text-2xl font-semibold tabular-nums ${kpis.changedCount > 0 ? "text-warning" : ""}`}>
                {kpis.changedCount}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">Conditions Changed — needs review</div>
            </CardContent>
          </Card>
        </div>
      )}

      <form className="mb-4 flex flex-wrap items-end gap-2">
        <div className="min-w-52 flex-1">
          <Input name="q" placeholder="Search by job, ref or title…" defaultValue={sp.q ?? ""} />
        </div>
        <Select name="vesselId" defaultValue={sp.vesselId ?? ""} className="w-56">
          <option value="">All active vessels</option>
          {vessels.map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </Select>
        <Button type="submit" variant="outline">Filter</Button>
      </form>

      {executions.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <ClipboardList className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No job executions recorded yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {canExecute
              ? "Click \"Create Job\" to pick an approved Risk Assessment from the library and execute it for a job."
              : "No jobs have been executed against a Risk Assessment yet."}
          </p>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-4">
            <div className="mb-3 text-sm font-medium">Job executions</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Date</th>
                    <th className="py-2 pr-4 font-medium">Vessel</th>
                    <th className="py-2 pr-4 font-medium">Job</th>
                    <th className="py-2 pr-4 font-medium">Risk Assessment</th>
                    <th className="py-2 pr-4 font-medium">Rev</th>
                    <th className="py-2 pr-4 font-medium">Conditions</th>
                    <th className="py-2 font-medium">Toolbox</th>
                  </tr>
                </thead>
                <tbody>
                  {executions.map((e) => (
                    <tr key={e.id} className="border-b border-border last:border-0">
                      <td className="py-2 pr-4 text-muted-foreground">{formatDate(e.executedAt)}</td>
                      <td className="py-2 pr-4">{e.vessel.name}</td>
                      <td className="py-2 pr-4">{e.jobName}</td>
                      <td className="py-2 pr-4">
                        <Link href={`/risk/${e.document.id}`} className="text-accent hover:underline">
                          {e.document.refNo}
                        </Link>{" "}
                        <span className="text-muted-foreground">— {e.document.title}</span>
                      </td>
                      <td className="py-2 pr-4 tabular-nums text-muted-foreground">{e.revision.revisionNo}</td>
                      <td className="py-2 pr-4">
                        <Badge tone={e.conditionStatus === "CHANGED" ? "warning" : "success"}>
                          {humanize(e.conditionStatus)}
                        </Badge>
                      </td>
                      <td className="py-2 text-muted-foreground">{e.toolboxSignedAt ? "Signed" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm text-muted-foreground">
                <span>
                  Showing {(page - 1) * 30 + 1}–{Math.min(page * 30, total)} of {total}
                </span>
                <div className="flex items-center gap-2">
                  {page > 1 ? (
                    <Link href={pageHref(page - 1)}>
                      <Button type="button" variant="outline" size="sm">
                        <ChevronLeft className="h-4 w-4" /> Prev
                      </Button>
                    </Link>
                  ) : (
                    <Button type="button" variant="outline" size="sm" disabled>
                      <ChevronLeft className="h-4 w-4" /> Prev
                    </Button>
                  )}
                  <span className="tabular-nums">Page {page} of {totalPages}</span>
                  {page < totalPages ? (
                    <Link href={pageHref(page + 1)}>
                      <Button type="button" variant="outline" size="sm">
                        Next <ChevronRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  ) : (
                    <Button type="button" variant="outline" size="sm" disabled>
                      Next <ChevronRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
