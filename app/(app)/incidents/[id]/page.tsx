import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { getIncident, getIncidentSubcategoryOptions } from "@/features/incidents/queries";
import { listCapaActions } from "@/features/capa/queries";
import { CapaTracker, type CapaRowView } from "@/components/capa/capa-tracker";
import { listAttachments } from "@/features/attachments/queries";
import { AttachmentList } from "@/components/attachments/attachment-list";
import {
  INCIDENT_STATUSES,
  INCIDENT_TYPE_LABELS,
  INCIDENT_SUBCATEGORY_LABELS,
  humanize,
  positionsFor,
} from "@/features/incidents/schema";
import { formatRootCause } from "@/lib/root-cause";
import { severityTone, incidentStatusTone } from "@/features/incidents/ui";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { InvestigationForm } from "./investigation-form";
import { IncidentActions, ReportDraftIncidentButton, DeleteDraftIncidentButton } from "./incident-actions";
import { EditDraftIncidentForm } from "./edit-draft-form";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import type { IncidentStatus } from "@/lib/generated/prisma";

function nextOf(status: IncidentStatus): IncidentStatus | null {
  const i = INCIDENT_STATUSES.indexOf(status);
  return (INCIDENT_STATUSES[i + 1] as IncidentStatus | undefined) ?? null;
}

function toRowView(r: {
  id: string;
  code: string;
  action: string;
  responsible: string | null;
  targetDate: Date | null;
  status: "OPEN" | "IN_PROGRESS" | "CLOSED";
  closedDate: Date | null;
}): CapaRowView {
  return {
    ...r,
    targetDate: r.targetDate ? r.targetDate.toISOString() : null,
    closedDate: r.closedDate ? r.closedDate.toISOString() : null,
  };
}

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("incident:read");
  const { id } = await params;
  const isShipboard = user.department === "SHIPBOARD";
  const inc = await getIncident(user.companyId, id, isShipboard, user.id, user.vesselId);
  if (!inc) notFound();

  // A draft is only ever visible to a shipboard user (any vessel account) or
  // to the specific office user who created it (see queries.ts) — so
  // reaching this page while it's still DRAFT already means "mine to act
  // on." Nothing below this (investigation, CAPA, attachments) applies yet
  // to a report that hasn't gone out, so drafts get their own short-circuit
  // view instead of the full page.
  const isOwnDraft =
    inc.status === "DRAFT" && can(user, "incident:create") && (isShipboard || inc.createdBy === user.id);

  if (inc.status === "DRAFT") {
    const subcategoryOptions = await getIncidentSubcategoryOptions(user.companyId);
    return (
      <div className="mx-auto max-w-7xl">
        <Link
          href="/incidents"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Incidents
        </Link>
        <PageHeader
          title={`Draft — ${inc.title}`}
          actions={
            <div className="flex items-center gap-2">
              <Badge tone={incidentStatusTone(inc.status)}>{humanize(inc.status)}</Badge>
              {isOwnDraft && <DeleteDraftIncidentButton incidentId={inc.id} />}
              {isOwnDraft && <ReportDraftIncidentButton incidentId={inc.id} />}
            </div>
          }
        />
        {isOwnDraft ? (
          <EditDraftIncidentForm
            incident={{
              id: inc.id,
              title: inc.title,
              reporterName: inc.reporterName ?? "",
              reporterPosition: inc.reporterPosition ?? "",
              occurredAt: inc.occurredAt.toISOString().slice(0, 10),
              location: inc.location,
              description: inc.description,
              immediateAction: inc.immediateAction,
              typeEntries: inc.typeEntries.map((e) => ({ type: e.type, subCategory: e.subCategory })),
              sofEntries: inc.sofEntries.map((s) => ({ time: s.time, event: s.event })),
            }}
            positions={positionsFor(user.department)}
            subcategoryOptions={subcategoryOptions}
            ownVesselName={inc.vessel?.name ?? null}
          />
        ) : (
          <p className="text-sm text-muted-foreground">You don't have access to edit this draft.</p>
        )}
      </div>
    );
  }

  const canUpdate = can(user, "incident:update");
  const canClose = can(user, "incident:close");
  const canDelete = can(user, "incident:delete");
  const next = nextOf(inc.status);
  const canAdvance =
    canUpdate && !!next && (next !== "CLOSED" || canClose);
  const editable = canUpdate && inc.status !== "CLOSED";

  const [correctiveRows, preventiveRows, attachments] = await Promise.all([
    listCapaActions(user.companyId, "Incident", inc.id, "CORRECTIVE"),
    listCapaActions(user.companyId, "Incident", inc.id, "PREVENTIVE"),
    listAttachments(user.companyId, "Incident", inc.id),
  ]);

  const meta = [
    { label: "Vessel", value: inc.vessel?.name ?? "Shore / N/A" },
    { label: "Occurred", value: formatDate(inc.occurredAt) },
    { label: "Vessel Position", value: inc.location ?? "—" },
    {
      label: "Root cause",
      value: inc.rootCauseCategory
        ? formatRootCause(inc.rootCauseCategory, inc.rootCauseSubCategory)
        : "Pending investigation",
    },
    {
      label: "Reported by",
      value: inc.reporterName
        ? `${inc.reporterName} — ${inc.reporterPosition}`
        : (inc.reportedBy?.fullName ?? "—"),
    },
    { label: "Closed", value: inc.closedAt ? formatDate(inc.closedAt) : "—" },
    {
      label: "Verified by Management",
      value: inc.verifiedByName
        ? `${inc.verifiedByName} — ${formatDate(inc.verifiedAt)}`
        : "—",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <Link
        href="/incidents"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Incidents
      </Link>

      <PageHeader
        title={`${inc.refNo} — ${inc.title}`}
        actions={
          <div className="flex items-center gap-2">
            {inc.severity ? (
              <Badge tone={severityTone(inc.severity)}>
                {humanize(inc.severity)}
              </Badge>
            ) : (
              <Badge tone="neutral">Severity pending</Badge>
            )}
            <Badge tone={incidentStatusTone(inc.status)}>
              {humanize(inc.status)}
            </Badge>
            <Link href={`/incidents/${inc.id}/report`} target="_blank" rel="noopener noreferrer">
              <Button type="button" variant="outline" size="sm">
                <FileText className="h-4 w-4" /> Show Report
              </Button>
            </Link>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {meta.map((m) => (
          <div key={m.label}>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {m.label}
            </div>
            <div className="mt-0.5 text-sm font-medium">{m.value}</div>
          </div>
        ))}
      </div>

      {/* Vessel particulars — pulled from the Vessel master record (never
          retyped per report) so the full ship's particulars travel with the
          report, matching the flag-state/class casualty report format. */}
      {inc.vessel && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Vessel Particulars</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "IMO Number", value: inc.vessel.imo ?? "—" },
              { label: "Official Number", value: inc.vessel.officialNumber ?? "—" },
              { label: "Call Sign", value: inc.vessel.callSign ?? "—" },
              { label: "MMSI Number", value: inc.vessel.mmsi ?? "—" },
              { label: "Flag State", value: inc.vessel.flag ?? "—" },
              { label: "Type of Ship", value: inc.vessel.type },
              { label: "Classification Society", value: inc.vessel.classificationSociety ?? "—" },
              { label: "Year Built", value: inc.vessel.yearBuilt ?? "—" },
              { label: "Gross Tonnage", value: inc.vessel.grossTonnage ?? "—" },
              {
                label: "LOA / Breadth / Depth (m)",
                value: `${inc.vessel.loa ?? "—"} / ${inc.vessel.breadth ?? "—"} / ${inc.vessel.depth ?? "—"}`,
              },
            ].map((m) => (
              <div key={m.label}>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{m.label}</div>
                <div className="mt-0.5 text-sm font-medium">{m.value}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Classification */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Classification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Type of incident
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {inc.typeEntries.length === 0 ? (
                <span className="text-sm text-muted-foreground">—</span>
              ) : (
                inc.typeEntries.map((e) => (
                  <Badge key={e.id} tone="accent">
                    {INCIDENT_TYPE_LABELS[e.type]} — {INCIDENT_SUBCATEGORY_LABELS[e.type][e.subCategory]}
                  </Badge>
                ))
              )}
            </div>
          </div>

          {inc.rootCauseCategory && (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Root cause
              </div>
              <div className="mt-1.5">
                <Badge tone="warning">
                  {formatRootCause(inc.rootCauseCategory, inc.rootCauseSubCategory)}
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* What happened */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>What happened</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Description
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm">{inc.description}</p>
          </div>
          {inc.sofEntries.length > 0 && (
            <div>
              <div className="mb-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                Statement of Facts (SOF)
              </div>
              <div className="overflow-hidden rounded-md border border-border">
                <table className="w-full table-fixed text-sm">
                  <colgroup>
                    <col className="w-28" />
                    <col />
                  </colgroup>
                  <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Time</th>
                      <th className="px-3 py-2 font-medium">Event</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inc.sofEntries.map((s) => (
                      <tr key={s.id} className="border-t border-border">
                        <td className="px-3 py-2 align-top">{s.time}</td>
                        <td className="px-3 py-2 align-top whitespace-pre-wrap">{s.event}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {inc.immediateAction && (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Immediate action
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm">
                {inc.immediateAction}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Investigation — root cause classification & narrative */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Investigation</CardTitle>
        </CardHeader>
        <CardContent>
          {editable ? (
            <InvestigationForm
              // Remounts only when navigating to a *different* incident —
              // otherwise this client component's own useState(prop) initial
              // values would go stale across a client-side incident-to-
              // incident navigation (they only run once, at first mount).
              // Deliberately NOT keyed on inc.updatedAt: that fired a
              // remount on every save round-trip (including failed ones),
              // wiping whatever the user had just typed before they could
              // fix a validation error.
              key={inc.id}
              incidentId={inc.id}
              investigationDetails={inc.investigationDetails ?? ""}
              severity={inc.severity ?? ""}
              rootCauseCategory={inc.rootCauseCategory ?? ""}
              rootCauseSubCategory={inc.rootCauseSubCategory ?? ""}
              rootCause={inc.rootCause ?? ""}
            />
          ) : inc.rootCauseCategory ? (
            <div className="space-y-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Details
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">
                  {inc.investigationDetails || "—"}
                </p>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Severity
                </div>
                <p className="mt-1 text-sm">
                  {inc.severity ? humanize(inc.severity) : "—"}
                </p>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Root cause
                </div>
                <p className="mt-1 text-sm">
                  {formatRootCause(inc.rootCauseCategory, inc.rootCauseSubCategory)}
                </p>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Root cause description
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">
                  {inc.rootCause || "—"}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Not yet investigated — the office will record the root cause here.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Corrective &amp; Preventive Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <CapaTracker
            entityType="Incident"
            entityId={inc.id}
            kind="CORRECTIVE"
            title="Corrective Actions"
            editable={editable}
            rows={correctiveRows.map(toRowView)}
          />
          <CapaTracker
            entityType="Incident"
            entityId={inc.id}
            kind="PREVENTIVE"
            title="Preventive Actions"
            editable={editable}
            rows={preventiveRows.map(toRowView)}
          />
        </CardContent>
      </Card>

      {/* Lifecycle — advancing/closing the incident happens after the full
          investigation + CAPA trail is in place, per the real workflow. */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Investigation lifecycle</CardTitle>
        </CardHeader>
        <CardContent>
          <IncidentActions
            incidentId={inc.id}
            nextStatus={next}
            canAdvance={canAdvance}
            canDelete={canDelete}
          />
        </CardContent>
      </Card>

      {/* ECFA Report & Attachments — last: the full ECFA investigation report
          (and any supporting evidence) filed as a repository against the
          incident, once everything above it is complete. */}
      <Card>
        <CardHeader>
          <CardTitle>ECFA Report &amp; Attachments</CardTitle>
        </CardHeader>
        <CardContent>
          <AttachmentList
            entityType="Incident"
            entityId={inc.id}
            editable={editable}
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
