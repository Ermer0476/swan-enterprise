import Link from "next/link";
import { ArrowLeft, MessagesSquare } from "lucide-react";
import { requirePermission } from "@/lib/rbac";
import { listVesselFeedback, type VesselFeedbackItem } from "@/features/risk/queries";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, humanize } from "@/lib/utils";
import { dispositionTone } from "@/features/risk/ui";
import { DecideRevisionRequestForm } from "../[id]/decide-revision-request-form";
import { MarkReviewedButton } from "./mark-reviewed-button";
import { ReviewVesselHazardRowButton } from "./review-vessel-hazard-row-button";
import { EditExecutionControlForm } from "./edit-execution-control-form";

const TYPE_LABELS: Record<VesselFeedbackItem["type"], string> = {
  REVISION_REQUEST: "Revision Request",
  EXECUTION_CONTROL: "Execution Control",
  VESSEL_HAZARD_ROW: "Vessel Hazard Row",
};

function statusBadge(item: VesselFeedbackItem) {
  if (item.type === "REVISION_REQUEST") {
    const tone = item.status === "APPROVED" ? "success" : item.status === "REJECTED" ? "danger" : "warning";
    return <Badge tone={tone}>{humanize(item.status)}</Badge>;
  }
  return <Badge tone={item.status === "REVIEWED" ? "success" : "warning"}>{humanize(item.status)}</Badge>;
}

function actionControl(item: VesselFeedbackItem) {
  if (item.type === "REVISION_REQUEST") {
    return item.status === "PENDING" ? <DecideRevisionRequestForm requestId={item.id} /> : null;
  }
  if (item.type === "EXECUTION_CONTROL") {
    return item.status === "PENDING" ? <MarkReviewedButton controlId={item.id} /> : null;
  }
  return item.status === "PENDING" ? <ReviewVesselHazardRowButton rowId={item.id} /> : null;
}

export default async function VesselFeedbackPage() {
  const user = await requirePermission("risk-doc:approve");
  const items = await listVesselFeedback(user.companyId);

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/risk"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Risk Assessments
      </Link>

      <PageHeader
        title="Vessel Feedback"
        description="Everything vessels have raised against a Risk Assessment — revision requests, job-execution controls, and vessel-added hazards — in one place, triaged with a single disposition vocabulary."
      />

      {items.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <MessagesSquare className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No vessel feedback yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Revision requests, execution-added controls, and vessel-authored hazard rows will appear here as vessels raise them.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={`${item.type}-${item.id}`}>
              <CardContent className="pt-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Link href={`/risk/${item.documentId}`} className="text-sm font-semibold text-accent hover:underline">
                      {item.refNo}
                    </Link>
                    <span className="ml-1 text-sm text-muted-foreground">— {item.title}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {item.vesselName ?? "—"} · {formatDate(item.date)}
                  </span>
                </div>

                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge tone="neutral">{TYPE_LABELS[item.type]}</Badge>
                  {statusBadge(item)}
                  {item.disposition && (
                    <Badge tone={dispositionTone(item.disposition)}>{humanize(item.disposition)}</Badge>
                  )}
                </div>

                {item.type === "EXECUTION_CONTROL" && item.status === "PENDING" ? (
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{item.hazardConsequence}</p>
                    <EditExecutionControlForm
                      controlId={item.id}
                      vesselText={item.controlText ?? ""}
                      initialOfficeWording={item.officeWording ?? ""}
                    />
                  </div>
                ) : item.type === "EXECUTION_CONTROL" && item.disposition === "ADDED_TO_TEMPLATE" ? (
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium">{item.hazardConsequence}</p>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Vessel submitted</div>
                      <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">{item.controlText}</p>
                    </div>
                    <div className="rounded-md border border-success/30 bg-success/5 p-2.5">
                      <div className="text-xs uppercase tracking-wide text-success">
                        Final wording to insert into template
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap text-sm">
                        {item.officeWording || item.controlText}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-sm">{item.itemSummary}</p>
                )}

                {actionControl(item) && <div className="mt-2.5">{actionControl(item)}</div>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
