import Link from "next/link";
import { Plus, ShieldCheck } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { listRiskAssessments } from "@/features/risk/queries";
import { computeRiskLevel } from "@/features/risk/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDate, humanize } from "@/lib/utils";
import { riskAssessmentStatusTone } from "@/features/risk/ui";
import type { RiskAssessmentStatus } from "@/lib/generated/prisma";

function riskTone(level: string) {
  if (level === "HIGH") return "danger";
  if (level === "MEDIUM") return "warning";
  return "success";
}

export default async function RiskAssessmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("risk:read");
  const sp = await searchParams;
  const rows = await listRiskAssessments(user.companyId, {
    search: sp.q || undefined,
    status: (sp.status as RiskAssessmentStatus) || undefined,
  });
  const canCreate = can(user, "risk:create");

  return (
    <>
      <PageHeader
        title="Risk Assessments"
        description="Task/operation risk assessments — hazards, controls, and likelihood × severity rating."
        actions={
          canCreate ? (
            <Link href="/risk/new">
              <Button><Plus className="h-4 w-4" /> New Assessment</Button>
            </Link>
          ) : undefined
        }
      />

      <form className="mb-4 flex flex-wrap items-end gap-2">
        <div className="min-w-52 flex-1">
          <Input name="q" placeholder="Search by ref or activity…" defaultValue={sp.q ?? ""} />
        </div>
        <Select name="status" defaultValue={sp.status ?? ""} className="w-40">
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUPERSEDED">Superseded</option>
          <option value="CLOSED">Closed</option>
        </Select>
        <Button type="submit" variant="outline">Filter</Button>
      </form>

      {rows.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <ShieldCheck className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No risk assessments found</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {canCreate ? "Assess a task or operation before it's carried out." : "No assessments match your filters."}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Ref</th>
                  <th className="px-4 py-2.5 font-medium">Activity</th>
                  <th className="px-4 py-2.5 font-medium">Vessel</th>
                  <th className="px-4 py-2.5 font-medium">Risk level</th>
                  <th className="px-4 py-2.5 font-medium">Assessed</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const level = computeRiskLevel(r.likelihood, r.severity);
                  return (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-2.5 font-mono text-xs">
                        <Link href={`/risk/${r.id}`} className="text-accent hover:underline">{r.refNo}</Link>
                      </td>
                      <td className="px-4 py-2.5">
                        <Link href={`/risk/${r.id}`} className="hover:underline">{r.activity}</Link>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{r.vessel?.name ?? "Shore"}</td>
                      <td className="px-4 py-2.5"><Badge tone={riskTone(level)}>{humanize(level)}</Badge></td>
                      <td className="px-4 py-2.5 text-muted-foreground">{formatDate(r.assessmentDate)}</td>
                      <td className="px-4 py-2.5"><Badge tone={riskAssessmentStatusTone(r.status)}>{humanize(r.status)}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
