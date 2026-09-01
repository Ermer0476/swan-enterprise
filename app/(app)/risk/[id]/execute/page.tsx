import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/rbac";
import { getRiskDocument, listVesselOptions } from "@/features/risk/queries";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ExecutionForm } from "./execution-form";

export default async function ExecuteRiskAssessmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("risk-doc:execute");
  const { id } = await params;
  const [doc, vessels] = await Promise.all([
    getRiskDocument(user.companyId, id),
    listVesselOptions(user.companyId),
  ]);
  if (!doc) notFound();

  const isShipboard = user.department === "SHIPBOARD";
  // Master rows (fleet-wide) plus this vessel's own addenda — a shipboard
  // user shouldn't see another vessel's addendum rows when picking what
  // applies to their job. Office sees every row on the revision.
  const hazardRows = (doc.currentRevision?.hazardRows ?? [])
    .filter((r) => !isShipboard || !r.vesselId || r.vesselId === user.vesselId)
    .map((r) => ({
      id: r.id,
      phase: r.phase,
      consequence: r.consequence,
      existingControls: r.existingControls,
      additionalControls: r.additionalControls,
      severity: r.severity,
      likelihood: r.likelihood,
      resLikelihood: r.resLikelihood,
      isVesselAddendum: !!r.vesselId,
    }));

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/risk/${doc.id}`}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to {doc.refNo}
      </Link>

      <PageHeader
        title={`Execute — ${doc.title}`}
        description="Confirm conditions and record this job's execution against the current approved revision. Temporary additions apply only to this job — the master Risk Assessment is never changed."
      />

      <Card>
        <CardContent className="pt-5">
          <ExecutionForm
            documentId={doc.id}
            vessels={vessels}
            isShipboard={isShipboard}
            ownVesselId={user.vesselId}
            ownVesselName={vessels.find((v) => v.id === user.vesselId)?.name ?? null}
            hazardRows={hazardRows}
          />
        </CardContent>
      </Card>
    </div>
  );
}
