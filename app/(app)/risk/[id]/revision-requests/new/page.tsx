import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/rbac";
import { getRiskDocument } from "@/features/risk/queries";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { RevisionRequestForm } from "./revision-request-form";

export default async function NewRevisionRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("risk-doc:request-revision");
  const { id } = await params;
  const doc = await getRiskDocument(user.companyId, id);
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
        title={`Request a revision — ${doc.title}`}
        description="Propose a change to the office. You cannot edit this Risk Assessment directly."
      />

      <Card>
        <CardContent className="pt-5">
          <RevisionRequestForm documentId={doc.id} />
        </CardContent>
      </Card>
    </div>
  );
}
