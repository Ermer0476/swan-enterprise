import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { getDocument } from "@/features/documents/queries";
import { DOCUMENT_STATUSES } from "@/features/documents/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, humanize } from "@/lib/utils";
import { DocumentActions } from "./document-actions";
import type { ControlledDocStatus } from "@/lib/generated/prisma";

function statusTone(s: string) {
  if (s === "APPROVED") return "success";
  if (s === "SUPERSEDED") return "danger";
  return "warning";
}

function nextOf(status: ControlledDocStatus): ControlledDocStatus | null {
  const i = DOCUMENT_STATUSES.indexOf(status);
  return (DOCUMENT_STATUSES[i + 1] as ControlledDocStatus | undefined) ?? null;
}

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("doc:read");
  const { id } = await params;
  const doc = await getDocument(user.companyId, id);
  if (!doc) notFound();

  const canAdvance = can(user, "doc:update");
  const canDelete = can(user, "doc:delete");
  const next = nextOf(doc.status);

  const meta = [
    { label: "Category", value: humanize(doc.category) },
    { label: "Vessel", value: doc.vessel?.name ?? "Fleet-wide" },
    { label: "Version", value: doc.version ?? "—" },
    { label: "Issued", value: formatDate(doc.issueDate) },
    { label: "Review due", value: formatDate(doc.reviewDate) },
    { label: "Owner", value: doc.owner ?? "—" },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/documents" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Documents
      </Link>

      <PageHeader
        title={`${doc.docNumber} — ${doc.title}`}
        actions={<Badge tone={statusTone(doc.status)}>{humanize(doc.status)}</Badge>}
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
        <CardHeader><CardTitle>Document status</CardTitle></CardHeader>
        <CardContent>
          <DocumentActions docId={doc.id} nextStatus={next} canAdvance={canAdvance} canDelete={canDelete} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Description</CardTitle></CardHeader>
        <CardContent><p className="whitespace-pre-wrap text-sm">{doc.description || "—"}</p></CardContent>
      </Card>
    </div>
  );
}
