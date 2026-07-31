import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { getRiskAssessment } from "@/features/risk/queries";
import { computeRiskLevel } from "@/features/risk/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, humanize } from "@/lib/utils";
import { RiskActions } from "./risk-actions";

function riskTone(level: string) {
  if (level === "HIGH") return "danger";
  if (level === "MEDIUM") return "warning";
  return "success";
}

function statusTone(s: string) {
  if (s === "CLOSED") return "success";
  if (s === "SUPERSEDED") return "danger";
  return "warning";
}

export default async function RiskAssessmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("risk:read");
  const { id } = await params;
  const ra = await getRiskAssessment(user.companyId, id);
  if (!ra) notFound();

  const canClose = can(user, "risk:close");
  const canDelete = can(user, "risk:delete");
  const level = computeRiskLevel(ra.likelihood, ra.severity);

  const meta = [
    { label: "Vessel", value: ra.vessel?.name ?? "Shore" },
    { label: "Likelihood", value: humanize(ra.likelihood) },
    { label: "Severity", value: humanize(ra.severity) },
    { label: "Assessed", value: formatDate(ra.assessmentDate) },
    { label: "Review due", value: formatDate(ra.reviewDate) },
    { label: "Assessed by", value: ra.assessedBy ?? "—" },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/risk" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Risk Assessments
      </Link>

      <PageHeader
        title={`${ra.refNo} — ${ra.activity}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={riskTone(level)}>{humanize(level)} risk</Badge>
            <Badge tone={statusTone(ra.status)}>{humanize(ra.status)}</Badge>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {meta.map((m) => (
          <div key={m.label}>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{m.label}</div>
            <div className="mt-0.5 text-sm font-medium">{m.value}</div>
          </div>
        ))}
      </div>

      <Card className="mb-6">
        <CardHeader><CardTitle>Assessment status</CardTitle></CardHeader>
        <CardContent>
          <RiskActions riskId={ra.id} isActive={ra.status === "ACTIVE"} canClose={canClose} canDelete={canDelete} />
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle>Hazards identified</CardTitle></CardHeader>
        <CardContent><p className="whitespace-pre-wrap text-sm">{ra.hazards}</p></CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle>Existing controls</CardTitle></CardHeader>
        <CardContent><p className="whitespace-pre-wrap text-sm">{ra.existingControls || "—"}</p></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Additional controls required</CardTitle></CardHeader>
        <CardContent><p className="whitespace-pre-wrap text-sm">{ra.additionalControls || "—"}</p></CardContent>
      </Card>
    </div>
  );
}
