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
            isShipboard={user.department === "SHIPBOARD"}
            ownVesselId={user.vesselId}
            ownVesselName={vessels.find((v) => v.id === user.vesselId)?.name ?? null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
