import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { getIncident } from "@/features/incidents/queries";
import { listCapaActions, listAllCapaActions } from "@/features/capa/queries";
import {
  CapaTracker,
  CapaSummaryTable,
  type CapaRowView,
  type CapaSummaryRowView,
} from "@/components/capa/capa-tracker";
import { listAttachments } from "@/features/attachments/queries";
import { AttachmentList } from "@/components/attachments/attachment-list";
import {
  INCIDENT_STATUSES,
  INCIDENT_TYPE_LABELS,
  INCIDENT_SUBCATEGORY_LABELS,
  ROOT_CAUSE_LABELS,
  ROOT_CAUSE_SUBCATEGORY_LABELS,
  humanize,
} from "@/features/incidents/schema";
import { severityTone, incidentStatusTone } from "@/features/incidents/ui";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { InvestigationForm } from "./investigation-form";
import { IncidentActions } from "./incident-actions";
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

function toSummaryRowView(
  r: Parameters<typeof toRowView>[0] & { kind: "CORRECTIVE" | "PREVENTIVE" },
): CapaSummaryRowView {
  return { ...toRowView(r), kind: r.kind };
}

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("incident:read");
  const { id } = await params;
  const inc = await getIncident(user.companyId, id);
  if (!inc) notFound();

  const canUpdate = can(user, "incident:update");
  const canClose = can(user, "incident:close");
  const canDelete = can(user, "incident:delete");
  const next = nextOf(inc.status);
  const canAdvance =
    canUpdate && !!next && (next !== "CLOSED" || canClose);
  const editable = canUpdate && inc.status !== "CLOSED";

  const [correctiveRows, preventiveRows, allCapaRows, attachments] = await Promise.all([
    listCapaActions(user.companyId, "Incident", inc.id, "CORRECTIVE"),
    listCapaActions(user.companyId, "Incident", inc.id, "PREVENTIVE"),
    listAllCapaActions(user.companyId, "Incident", inc.id),
    listAttachments(user.companyId, "Incident", inc.id),
  ]);

  const meta = [
    { label: "Vessel", value: inc.vessel?.name ?? "Shore / N/A" },
    { label: "Occurred", value: formatDate(inc.occurredAt) },
    { label: "Location", value: inc.location ?? "—" },
    {
      label: "Root cause",
      value: inc.rootCauseCategory
        ? ROOT_CAUSE_LABELS[inc.rootCauseCategory]
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
    <div className="mx-auto max-w-4xl">
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
              { label: "IMO Number", value: inc.vessel.imo },
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

          {inc.rootCauseCategory && inc.rootCauseSubCategory && (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Root cause sub-category
              </div>
              <div className="mt-1.5">
                <Badge tone="warning">
                  {ROOT_CAUSE_SUBCATEGORY_LABELS[inc.rootCauseCategory][inc.rootCauseSubCategory]}
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
                  Root cause sub-category
                </div>
                <p className="mt-1 text-sm">
                  {inc.rootCauseCategory && inc.rootCauseSubCategory
                    ? ROOT_CAUSE_SUBCATEGORY_LABELS[inc.rootCauseCategory][inc.rootCauseSubCategory]
                    : "—"}
                </p>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Root cause
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

      {/* CAPA tracker — TMSA-style corrective & preventive action plan */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>CAPA Tracker</CardTitle>
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

          {/* Merged, read-only register of every CAPA item — corrective and
              preventive together, identified by their CA-/PA- ID so both stay
              easy to track from one place. */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">All CAPA Items</h4>
            <CapaSummaryTable
              rows={allCapaRows.map(toSummaryRowView)}
              editable={editable}
            />
          </div>
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
