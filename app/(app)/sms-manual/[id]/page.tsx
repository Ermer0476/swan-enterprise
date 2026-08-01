import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, History } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { getDocument } from "@/features/sms-manual/queries";
import { SMS_ENTITY_TYPE } from "@/features/sms-manual/schema";
import {
  getActiveInstance,
  currentStep,
  canAct,
} from "@/features/workflow/engine";
import { WorkflowProgress } from "@/features/workflow/workflow-progress";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { DocumentActions } from "./document-actions";
import { AddRevisionForm } from "./add-revision-form";

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("sms:read");
  const { id } = await params;
  const doc = await getDocument(user.companyId, id);
  if (!doc) notFound();

  const canEdit = can(user, "sms:update");

  // Approval authorization is step-based: fetch the active workflow instance
  // and check whether this user is the approver for the current step.
  const instance =
    doc.status === "IN_REVIEW"
      ? await getActiveInstance(user.companyId, SMS_ENTITY_TYPE, doc.id)
      : null;
  const step = instance ? currentStep(instance) : null;
  const caps = {
    canSubmit: can(user, "sms:submit"),
    canDecide: !!step && canAct(user, step),
    canArchive: can(user, "sms:delete"),
  };

  const inForce = doc.currentRevision;
  const draftInProgress =
    doc.status !== "IN_REVIEW" && doc.status !== "ARCHIVED" && canEdit;

  return (
    <div className="mx-auto max-w-7xl">
      <Link
        href="/sms-manual"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to SMS Manual
      </Link>

      <PageHeader
        title={`${doc.code} — ${doc.title}`}
        description={doc.description ?? undefined}
        actions={
          <Badge tone={statusTone(doc.status)}>
            {doc.status.replace("_", " ")}
          </Badge>
        }
      />

      {/* Meta */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Department", value: doc.department },
          { label: "Category", value: doc.category },
          { label: "Owner", value: doc.owner?.fullName ?? "—" },
          {
            label: "In-force revision",
            value: inForce ? `Rev ${inForce.revisionNo}` : "None yet",
          },
        ].map((m) => (
          <div key={m.label}>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {m.label}
            </div>
            <div className="mt-0.5 text-sm font-medium">{m.value}</div>
          </div>
        ))}
      </div>

      {/* Workflow actions */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Approval workflow</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {instance && (
            <div className="rounded-md border border-border bg-muted/30 p-4">
              <WorkflowProgress instance={instance} />
            </div>
          )}
          <DocumentActions
            documentId={doc.id}
            status={doc.status}
            caps={caps}
          />
        </CardContent>
      </Card>

      {/* In-force content */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>
            {inForce
              ? `In-force content · Rev ${inForce.revisionNo}`
              : "Latest draft content"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="whitespace-pre-wrap break-words font-sans text-sm text-foreground">
            {inForce?.content ??
              doc.revisions[0]?.content ??
              "No content authored yet."}
          </pre>
          {inForce?.effectiveDate && (
            <p className="mt-3 text-xs text-muted-foreground">
              Effective {formatDate(inForce.effectiveDate)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Add revision */}
      {draftInProgress && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Add a new revision</CardTitle>
          </CardHeader>
          <CardContent>
            <AddRevisionForm documentId={doc.id} />
          </CardContent>
        </Card>
      )}

      {/* Revision history */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4" /> Revision history
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-medium">Rev</th>
                  <th className="py-2 pr-4 font-medium">Change summary</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Effective</th>
                  <th className="py-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {doc.revisions.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="py-2 pr-4 tabular-nums">{r.revisionNo}</td>
                    <td className="py-2 pr-4">{r.changeSummary ?? "—"}</td>
                    <td className="py-2 pr-4">
                      <Badge tone={statusTone(r.status)}>
                        {r.status.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {formatDate(r.effectiveDate)}
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {formatDate(r.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
