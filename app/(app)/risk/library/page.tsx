import Link from "next/link";
import { Plus, ShieldCheck, FileClock, FileX2, ArrowLeft } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import {
  listRiskDocuments,
  riskDashboardCounts,
  mostUsedRiskDocuments,
  neverUsedRiskDocuments,
  overallRiskBand,
} from "@/features/risk/queries";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { RiskDocTable, type RiskDocRowView } from "./risk-table";
import type { DocumentStatus } from "@/lib/generated/prisma";

export default async function RiskAssessmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("risk-doc:read");
  const sp = await searchParams;
  const canCreate = can(user, "risk-doc:create");

  // Office can pick any status (e.g. to find their own draft-in-progress);
  // vessels only ever see live/approved Risk Assessments — no draft/in-review
  // visibility at all. Default view for everyone is "Approved".
  const statusFilter: DocumentStatus | undefined = canCreate
    ? (sp.status as DocumentStatus) || "APPROVED"
    : "APPROVED";

  const [rows] = await Promise.all([
    listRiskDocuments(user.companyId, {
      search: sp.q || undefined,
      status: statusFilter,
    }),
  ]);

  const tableRows: RiskDocRowView[] = rows.map((r) => ({
    id: r.id,
    refNo: r.refNo,
    title: r.title,
    category: r.category,
    vesselName: r.vessel?.name ?? null,
    status: r.status,
    riskLevel: r.currentRevision ? overallRiskBand(r.currentRevision.hazardRows) : null,
    nextReviewDate: r.nextReviewDate ? r.nextReviewDate.toISOString() : null,
    executionCount: r._count.executions,
  }));

  const emptyState = (
    <Card className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <ShieldCheck className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm font-medium">No Risk Assessments found</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        {canCreate ? "Create a controlled Risk Assessment before it's executed onboard." : "No assessments match your filters."}
      </p>
    </Card>
  );

  const table = (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <RiskDocTable rows={tableRows} />
      </div>
    </Card>
  );

  if (!canCreate) {
    // Vessel-side: a plain pick-list of live Risk Assessments to execute —
    // no dashboard KPIs, no status filter, no draft/in-review visibility.
    return (
      <>
        <Link href="/risk" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Job Executions
        </Link>
        <PageHeader
          title="Risk Assessment Library"
          description="Pick a Risk Assessment to execute for this job."
        />
        <form className="mb-4 flex flex-wrap items-end gap-2">
          <div className="min-w-52 flex-1">
            <Input name="q" placeholder="Search by ref, title, category…" defaultValue={sp.q ?? ""} />
          </div>
          <Button type="submit" variant="outline">Search</Button>
        </form>
        {tableRows.length === 0 ? emptyState : table}
      </>
    );
  }

  const [counts, mostUsed, neverUsed] = await Promise.all([
    riskDashboardCounts(user.companyId),
    mostUsedRiskDocuments(user.companyId, 5),
    neverUsedRiskDocuments(user.companyId, 5),
  ]);

  const kpis = [
    { label: "Total Risk Assessments", value: counts.total },
    { label: "Active Risk Assessments", value: counts.active },
    { label: "Archived", value: counts.archived },
    { label: "Due for Review", value: counts.dueSoon },
    { label: "Overdue Reviews", value: counts.overdue },
    { label: "Pending Revision Requests", value: counts.pendingRequests },
  ];

  return (
    <>
      <Link href="/risk" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Job Executions
      </Link>
      <PageHeader
        title="Risk Assessment Library"
        description="Controlled-document library — ISM / SIRE 2.0 / TMSA 3 aligned. Office owns the library; vessels view and execute."
        actions={
          <Link href="/risk/new">
            <Button><Plus className="h-4 w-4" /> New Risk Assessment</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="pt-4">
              <div className="text-2xl font-semibold tabular-nums">{k.value}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{k.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="pt-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <FileClock className="h-4 w-4 text-accent" /> Most Frequently Used
            </div>
            {mostUsed.length === 0 ? (
              <p className="text-sm text-muted-foreground">No executions recorded yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {mostUsed.map((d) => (
                  <li key={d.id} className="flex items-center justify-between py-1.5 text-sm">
                    <Link href={`/risk/${d.id}`} className="hover:underline">
                      <span className="font-mono text-xs text-muted-foreground">{d.refNo}</span> {d.title}
                    </Link>
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                      {d.totalUses} uses · {d.lastUsedAt ? formatDate(d.lastUsedAt) : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <FileX2 className="h-4 w-4 text-warning" /> Never Used
            </div>
            {neverUsed.length === 0 ? (
              <p className="text-sm text-muted-foreground">Every approved Risk Assessment has been used.</p>
            ) : (
              <ul className="divide-y divide-border">
                {neverUsed.map((d) => (
                  <li key={d.id} className="flex items-center justify-between py-1.5 text-sm">
                    <Link href={`/risk/${d.id}`} className="hover:underline">
                      <span className="font-mono text-xs text-muted-foreground">{d.refNo}</span> {d.title}
                    </Link>
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                      Since {formatDate(d.updatedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <form className="mb-4 mt-6 flex flex-wrap items-end gap-2">
        <div className="min-w-52 flex-1">
          <Input name="q" placeholder="Search by ref, title, category…" defaultValue={sp.q ?? ""} />
        </div>
        <Select name="status" defaultValue={statusFilter} className="w-40">
          <option value="DRAFT">Draft</option>
          <option value="IN_REVIEW">In Review</option>
          <option value="APPROVED">Approved</option>
          <option value="ARCHIVED">Archived</option>
        </Select>
        <Button type="submit" variant="outline">Filter</Button>
      </form>

      {tableRows.length === 0 ? emptyState : table}
    </>
  );
}
