import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { getDefect } from "@/features/defects/queries";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, humanize, severityTone } from "@/lib/utils";
import { DefectStatusForm } from "./defect-status-form";

function statusTone(s: string) {
  if (s === "RECTIFIED") return "success";
  if (s === "DEFERRED") return "accent";
  if (s === "MONITORING") return "warning";
  return "danger";
}

export default async function DefectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("defect:read");
  const { id } = await params;
  const defect = await getDefect(user.companyId, id);
  if (!defect) notFound();

  const editable = can(user, "defect:update");
  const canDelete = can(user, "defect:delete");

  const meta = [
    { label: "Vessel", value: defect.vessel?.name ?? "—" },
    { label: "Raised", value: formatDate(defect.dateRaised) },
    { label: "Target", value: formatDate(defect.targetRectificationDate) },
    { label: "Rectified", value: defect.rectifiedAt ? formatDate(defect.rectifiedAt) : "—" },
    { label: "Raised by", value: defect.raisedBy ?? "—" },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <Link href="/defects" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Defect List
      </Link>

      <PageHeader
        title={`${defect.refNo} — ${defect.equipment}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={severityTone(defect.severity)}>{humanize(defect.severity)}</Badge>
            <Badge tone={statusTone(defect.status)}>{humanize(defect.status)}</Badge>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {meta.map((m) => (
          <div key={m.label}>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{m.label}</div>
            <div className="mt-0.5 text-sm font-medium">{m.value}</div>
          </div>
        ))}
      </div>

      <Card className="mb-6">
        <CardHeader><CardTitle>Description</CardTitle></CardHeader>
        <CardContent><p className="whitespace-pre-wrap text-sm">{defect.description}</p></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Status &amp; rectification</CardTitle></CardHeader>
        <CardContent>
          <DefectStatusForm
            defectId={defect.id}
            status={defect.status}
            actionTaken={defect.actionTaken ?? ""}
            editable={editable}
            canDelete={canDelete}
          />
        </CardContent>
      </Card>
    </div>
  );
}
