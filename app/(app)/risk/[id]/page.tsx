import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, History, PlayCircle, FilePlus2, ChevronDown, FileText } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { getRiskDocument, userNameMap, overallRiskBand } from "@/features/risk/queries";
import {
  REVIEW_TRIGGER_LABELS,
  APPROVAL_LEVEL_LABELS,
} from "@/features/risk/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, humanize } from "@/lib/utils";
import { riskDocStatusTone, bandTone, reviewStatusTone } from "@/features/risk/ui";
import { listAttachments } from "@/features/attachments/queries";
import { AttachmentList } from "@/components/attachments/attachment-list";
import { RiskDocActions } from "./risk-actions";
import { AddRevisionForm } from "./add-revision-form";
import { DecideRevisionRequestForm } from "./decide-revision-request-form";
import { HazardRowForm } from "./hazard-row-form";
import { HazardRowsImportPanel } from "./hazard-rows-import-panel";
import { VesselHazardRowForm } from "./vessel-hazard-row-form";
import { HazardRowItem } from "./hazard-row-item";
import { JobExecutionsPanel } from "./job-executions-panel";

export default async function RiskDocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("risk-doc:read");
  const { id } = await params;
  // SHIPBOARD users may open a fleet-wide RA document or one belonging to
  // their own vessel — not another vessel's. OFFICE users are unrestricted.
  const isShipboard = user.department === "SHIPBOARD";
  const doc = await getRiskDocument(user.companyId, id, isShipboard ? user.vesselId : undefined);
  if (!doc) notFound();

  const canEdit = can(user, "risk-doc:update");
  const canPublish = can(user, "risk-doc:approve");
  const canExecute = can(user, "risk-doc:execute");
  const canRequestRevision = can(user, "risk-doc:request-revision");
  const canDecideRequests = can(user, "risk-doc:approve");
  const names = await userNameMap(user.companyId);

  const caps = {
    canPublish,
    canArchive: can(user, "risk-doc:archive"),
  };

  const inForce = doc.currentRevision;
  const draftRevision = doc.revisions[0]?.status === "DRAFT" ? doc.revisions[0] : null;
  const displayed = draftRevision ?? inForce ?? doc.revisions[0] ?? null;
  // Office is both author and approver — no internal review chain. A
  // DRAFT document (fresh or mid-edit) is directly editable; an APPROVED
  // one needs "Edit Risk Assessment" to open a new draft revision first.
  const editableRows = canEdit && doc.status === "DRAFT";
  const canStartEdit = canEdit && doc.status === "APPROVED";

  // Vessel-added rows (vesselId set) are only visible to the vessel that
  // added them and to office (risk-doc:update, for oversight) — never to
  // other vessels. Master rows (vesselId null) are visible to everyone.
  const visibleHazardRows = (displayed?.hazardRows ?? []).filter(
    (row) => !row.vesselId || row.vesselId === user.vesselId || canEdit,
  );
  // A vessel can add its own hazard row directly (no office review) only
  // while looking at the actual in-force revision — not a draft the office
  // is mid-editing, since new rows must attach to a stable revision.
  const canAddVesselRow = canExecute && !!user.vesselId && !!inForce && displayed?.id === inForce.id;
  // Vessel rows are editable by their owning vessel or by office at any
  // time (not just DRAFT) — the actions column must stay visible whenever
  // any row on the table qualifies, even if master-row editing is closed.
  const hasEditableVesselRow = visibleHazardRows.some(
    (row) => row.vesselId && ((row.vesselId === user.vesselId && canExecute) || canEdit),
  );

  const band = overallRiskBand(visibleHazardRows);
  const review = reviewStatusTone(doc.nextReviewDate);
  const pendingRequests = doc.revisionRequests.filter((r) => r.status === "PENDING");
  const attachments = await listAttachments(user.companyId, "RiskAssessmentDocument", doc.id);

  // Once ANY vessel has actually executed this RA for a job, the master
  // template (Library view — meta grid, Status/Archive card, hazard table,
  // revision history/requests) is no longer the working document for
  // anyone, office included — the Library is what the job execution's RA
  // was BASED ON, and the executed Job execution record below is now the
  // real, current thing. "Edit Risk Assessment" / "Execute for a job" /
  // "Request a revision" stay reachable regardless — this only hides the
  // read-only template display, not the ability to act on it.
  const docAlreadyExecuted = doc.executions.length > 0;

  // Group hazard rows by phase, preserving row order within each phase.
  const phases = new Map<string, typeof visibleHazardRows>();
  for (const row of visibleHazardRows) {
    const key = row.phase || "General";
    if (!phases.has(key)) phases.set(key, []);
    phases.get(key)!.push(row);
  }

  const meta = [
    { label: "Category", value: doc.category },
    { label: "Applicable vessel type", value: doc.applicableVesselType ?? "All types" },
    { label: "Owner", value: doc.ownerId ? names[doc.ownerId] ?? "—" : "—" },
    { label: "Review frequency", value: `${doc.reviewFrequencyMonths} months` },
    { label: "Last review", value: formatDate(doc.lastReviewDate) },
    { label: "Next review", value: formatDate(doc.nextReviewDate) },
    { label: "In-force revision", value: inForce ? `Rev ${inForce.revisionNo}` : "None yet" },
  ];

  const formMeta = [
    { label: "SMS Procedure", value: displayed?.smsProcedureRefs },
    { label: "Risk Matrix", value: displayed?.riskMatrixRef },
    { label: "Checklists Required", value: displayed?.checklistsRequired },
    {
      label: "Approval Level",
      value: displayed ? APPROVAL_LEVEL_LABELS[displayed.approvalLevel] : null,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <Link href="/risk/library" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Risk Assessment Library
      </Link>

      <PageHeader
        title={`${doc.refNo} — ${doc.title}`}
        description={doc.description ?? undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {band && <Badge tone={bandTone(band)}>Overall: {humanize(band)}</Badge>}
            <Badge tone={review.tone}>{review.label}</Badge>
            <Badge tone={riskDocStatusTone(doc.status)}>{humanize(doc.status)}</Badge>
            <Link href={`/risk/${doc.id}/report`} target="_blank" rel="noopener noreferrer">
              <Button type="button" variant="outline" size="sm">
                <FileText className="h-4 w-4" /> Show Report
              </Button>
            </Link>
          </div>
        }
      />

      {!docAlreadyExecuted && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {meta.map((m) => (
              <div key={m.label}>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{m.label}</div>
                <div className="mt-0.5 text-sm font-medium">{m.value}</div>
              </div>
            ))}
          </div>

          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {formMeta.map((m) => (
              <div key={m.label}>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{m.label}</div>
                <div className="mt-0.5 text-sm font-medium">{m.value || "—"}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="mb-6 flex flex-wrap items-start gap-2">
        {canStartEdit && (
          <AddRevisionForm
            documentId={doc.id}
            defaults={
              inForce
                ? {
                    smsProcedureRefs: inForce.smsProcedureRefs,
                    riskMatrixRef: inForce.riskMatrixRef,
                    checklistsRequired: inForce.checklistsRequired,
                    approvalLevel: inForce.approvalLevel,
                  }
                : null
            }
          />
        )}
        {canExecute && doc.currentRevisionId && (
          <Link href={`/risk/${doc.id}/execute`}>
            <Button variant="success" className="w-56"><PlayCircle className="h-4 w-4" /> Execute for a job</Button>
          </Link>
        )}
        {canRequestRevision && (
          <Link href={`/risk/${doc.id}/revision-requests/new`}>
            <Button variant="warning" className="w-56"><FilePlus2 className="h-4 w-4" /> Request a revision</Button>
          </Link>
        )}
      </div>

      {!docAlreadyExecuted && (
        <Card className="mb-6">
          <CardHeader><CardTitle>Status</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Office authors and finalizes Risk Assessments directly — there is no separate internal
              review step. Publishing makes the current draft revision the in-force version immediately.
            </p>
            <RiskDocActions documentId={doc.id} status={doc.status} caps={caps} />
          </CardContent>
        </Card>
      )}

      {docAlreadyExecuted ? (
        <Card className="mb-6">
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">
              You&apos;ve already executed this Risk Assessment for a job — see{" "}
              <span className="font-medium text-foreground">Job executions</span> below for the
              hazards you selected and the actual Severity/Likelihood you rated for that job.
            </p>
          </CardContent>
        </Card>
      ) : (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>
            {inForce && displayed?.id === inForce.id
              ? `Hazard table · Rev ${displayed.revisionNo} (in force)`
              : displayed
                ? `Hazard table · Rev ${displayed.revisionNo} (draft)`
                : "Hazard table"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {visibleHazardRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hazard rows yet.</p>
          ) : (
            Array.from(phases.entries()).map(([phase, rows]) => (
              <div key={phase}>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {phase}
                </div>
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">#</th>
                        <th className="px-3 py-2 font-medium">Consequence</th>
                        <th className="px-3 py-2 font-medium">Causes</th>
                        <th className="px-3 py-2 font-medium">S</th>
                        <th className="px-3 py-2 font-medium">L</th>
                        <th className="px-3 py-2 font-medium">RF</th>
                        <th className="px-3 py-2 font-medium">Existing Controls</th>
                        <th className="px-3 py-2 font-medium">Additional Controls</th>
                        <th className="px-3 py-2 font-medium">Res. L</th>
                        <th className="px-3 py-2 font-medium">Res. RF</th>
                        <th className="px-3 py-2 font-medium">Responsible</th>
                        {(editableRows || canAddVesselRow || hasEditableVesselRow) && (
                          <th className="px-3 py-2 font-medium"></th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const rowEditable = r.vesselId
                          ? (r.vesselId === user.vesselId && canExecute) || canEdit
                          : !!editableRows;
                        return (
                          <HazardRowItem
                            key={r.id}
                            row={{ ...r, vesselName: r.vessel?.name ?? null }}
                            documentId={doc.id}
                            editable={rowEditable}
                            showActionsColumn={!!editableRows || canAddVesselRow || hasEditableVesselRow}
                          />
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}

          {editableRows && displayed && <HazardRowsImportPanel revisionId={displayed.id} />}
          {editableRows && displayed && <HazardRowForm revisionId={displayed.id} />}
          {canAddVesselRow && inForce && <VesselHazardRowForm revisionId={inForce.id} />}
        </CardContent>
      </Card>
      )}

      {!docAlreadyExecuted && (
      <>
      <details className="group mb-6 rounded-lg border border-border bg-card text-card-foreground shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between p-5 pb-3 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <History className="h-4 w-4" /> Revision history
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-medium">Rev</th>
                  <th className="py-2 pr-4 font-medium">Change summary</th>
                  <th className="py-2 pr-4 font-medium">Trigger</th>
                  <th className="py-2 pr-4 font-medium">Rows</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Effective</th>
                  <th className="py-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {doc.revisions.map((r) => {
                  const notedRows = r.hazardRows.filter((h) => h.isNew || h.ratingChangeNote);
                  return (
                    <Fragment key={r.id}>
                      <tr className="border-b border-border last:border-0">
                        <td className="py-2 pr-4 tabular-nums">{r.revisionNo}</td>
                        <td className="py-2 pr-4">{r.changeSummary ?? "—"}</td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {r.reviewTrigger ? REVIEW_TRIGGER_LABELS[r.reviewTrigger] : "—"}
                        </td>
                        <td className="py-2 pr-4 tabular-nums text-muted-foreground">{r.hazardRows.length}</td>
                        <td className="py-2 pr-4"><Badge tone={riskDocStatusTone(r.status)}>{humanize(r.status)}</Badge></td>
                        <td className="py-2 pr-4 text-muted-foreground">{formatDate(r.effectiveDate)}</td>
                        <td className="py-2 text-muted-foreground">{formatDate(r.createdAt)}</td>
                      </tr>
                      {notedRows.length > 0 && (
                        <tr className="border-b border-border bg-muted/20 last:border-0">
                          <td></td>
                          <td colSpan={6} className="py-2 pr-4">
                            <ul className="space-y-1">
                              {notedRows.map((h) => (
                                <li key={h.id} className="text-xs text-muted-foreground">
                                  <Badge
                                    tone={h.isNew ? "accent" : "warning"}
                                    className="mr-1.5"
                                  >
                                    {h.isNew ? "★ New" : "↻ Revised"}
                                  </Badge>
                                  <span className="font-medium text-foreground">{h.consequence}:</span>{" "}
                                  {h.ratingChangeNote || "New hazard added in this revision."}
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </details>

      <Card className="mb-6">
        <CardHeader><CardTitle>Revision requests</CardTitle></CardHeader>
        <CardContent>
          {doc.revisionRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No revision requests yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Requested</th>
                    <th className="py-2 pr-4 font-medium">Reason</th>
                    <th className="py-2 pr-4 font-medium">Trigger</th>
                    <th className="py-2 pr-4 font-medium">By</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    {canDecideRequests && <th className="py-2 font-medium">Decide</th>}
                  </tr>
                </thead>
                <tbody>
                  {doc.revisionRequests.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0 align-top">
                      <td className="py-2 pr-4 text-muted-foreground">{formatDate(r.createdAt)}</td>
                      <td className="py-2 pr-4 max-w-xs">{r.reason}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{REVIEW_TRIGGER_LABELS[r.reviewTrigger]}</td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {r.requestedById ? names[r.requestedById] ?? "—" : "—"}
                      </td>
                      <td className="py-2 pr-4">
                        <Badge tone={r.status === "PENDING" ? "warning" : r.status === "APPROVED" ? "success" : "danger"}>
                          {humanize(r.status)}
                        </Badge>
                      </td>
                      {canDecideRequests && (
                        <td className="py-2">
                          {r.status === "PENDING" ? (
                            <DecideRevisionRequestForm requestId={r.id} />
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {r.decidedAt ? `Decided ${formatDate(r.decidedAt)}` : "—"}
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {pendingRequests.length > 0 && !canDecideRequests && (
            <p className="mt-2 text-xs text-muted-foreground">
              {pendingRequests.length} request(s) awaiting office decision.
            </p>
          )}
        </CardContent>
      </Card>
      </>
      )}

      <Card className="mb-6">
        <CardHeader><CardTitle>Job executions</CardTitle></CardHeader>
        <CardContent>
          <JobExecutionsPanel
            documentId={doc.id}
            canAddControl={canExecute}
            ownVesselId={isShipboard ? user.vesselId : null}
            executions={doc.executions.map((e) => ({
              id: e.id,
              execNo: e.execNo,
              vesselId: e.vesselId,
              executedAt: e.executedAt.toISOString(),
              vesselName: e.vessel.name,
              jobName: e.jobName,
              revisionNo: e.revision.revisionNo,
              conditionStatus: e.conditionStatus,
              changedConditionsNote: e.changedConditionsNote,
              temporaryHazards: e.temporaryHazards,
              temporaryControls: e.temporaryControls,
              toolboxSignedAt: e.toolboxSignedAt ? e.toolboxSignedAt.toISOString() : null,
              toolboxAttendees: e.toolboxAttendees,
              performedByName: e.performedById ? names[e.performedById] ?? null : null,
              hazards: e.hazardSelections.map((sel) => ({
                hazardRowId: sel.hazardRow.id,
                rowNo: sel.hazardRow.rowNo,
                consequence: sel.hazardRow.consequence,
                causes: sel.hazardRow.causes,
                existingControls: sel.hazardRow.existingControls,
                additionalControls: sel.hazardRow.additionalControls,
                responsible: sel.hazardRow.responsible,
                // Vessel's actual rating for this job — null on executions
                // recorded before this field existed; shown as "not recorded"
                // rather than backfilled from the (possibly since-revised)
                // template values.
                severity: sel.severity,
                likelihood: sel.likelihood,
                resLikelihood: sel.resLikelihood,
                addedControls: e.addedControls
                  .filter((c) => c.hazardRowId === sel.hazardRow.id)
                  .map((c) => ({
                    id: c.id,
                    controlText: c.controlText,
                    addedByName: c.addedBy ? names[c.addedBy] ?? null : null,
                    createdAt: c.createdAt.toISOString(),
                    reviewed: !!c.officeReviewedAt,
                    disposition: c.disposition,
                    officeWording: c.officeWording,
                  })),
              })),
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Attachments</CardTitle></CardHeader>
        <CardContent>
          <AttachmentList
            entityType="RiskAssessmentDocument"
            entityId={doc.id}
            editable={canEdit}
            attachments={attachments.map((a) => ({
              id: a.id,
              fileName: a.fileName,
              mimeType: a.mimeType,
              sizeBytes: a.sizeBytes,
              createdAt: a.createdAt.toISOString(),
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
