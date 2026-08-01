import Link from "next/link";
import { Plus, AlertTriangle } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import {
  listIncidents,
  getIncidentKpis,
  getIncidentRootCauseTrends,
  getIncidentTypeTrends,
} from "@/features/incidents/queries";
import {
  INCIDENT_STATUSES,
  INCIDENT_SEVERITIES,
  INCIDENT_TYPE_LABELS,
  humanize,
} from "@/features/incidents/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { IncidentsTable } from "./incidents-table";
import { IncidentKpiStrip } from "./incident-kpis";
import { RootCauseTrends } from "./root-cause-trends";
import { IncidentTypeTrends } from "./incident-type-trends";
import type { IncidentStatus, Severity } from "@/lib/generated/prisma";

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("incident:read");
  const sp = await searchParams;

  const [incidents, kpis, rootCauseTrends, typeTrends] = await Promise.all([
    listIncidents(user.companyId, {
      search: sp.q || undefined,
      status: (sp.status as IncidentStatus) || undefined,
      severity: (sp.severity as Severity) || undefined,
    }),
    getIncidentKpis(user.companyId),
    getIncidentRootCauseTrends(user.companyId),
    getIncidentTypeTrends(user.companyId),
  ]);
  const canCreate = can(user, "incident:create");

  return (
    <>
      <PageHeader
        title="Incident Management"
        description="Report, investigate and close incidents with root-cause and CAPA tracking."
        actions={
          canCreate ? (
            <Link href="/incidents/new">
              <Button>
                <Plus className="h-4 w-4" /> Report Incident
              </Button>
            </Link>
          ) : undefined
        }
      />

      <IncidentKpiStrip kpis={kpis} />
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <RootCauseTrends rows={rootCauseTrends} />
        <IncidentTypeTrends rows={typeTrends} />
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-2">
        <div className="min-w-52 flex-1">
          <Input
            name="q"
            placeholder="Search by ref or title…"
            defaultValue={sp.q ?? ""}
          />
        </div>
        <Select name="status" defaultValue={sp.status ?? ""} className="w-48">
          <option value="">All statuses</option>
          {INCIDENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {humanize(s)}
            </option>
          ))}
        </Select>
        <Select name="severity" defaultValue={sp.severity ?? ""} className="w-40">
          <option value="">All severities</option>
          {INCIDENT_SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {humanize(s)}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>

      {incidents.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <AlertTriangle className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No incidents found</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {canCreate
              ? "Report an incident to begin an investigation record."
              : "No incidents match your filters."}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <IncidentsTable
              rows={incidents.map((inc) => ({
                id: inc.id,
                refNo: inc.refNo,
                title: inc.title,
                vesselName: inc.vessel?.name ?? null,
                typeLabels: inc.typeEntries.map((e) => INCIDENT_TYPE_LABELS[e.type]),
                severity: inc.severity,
                occurredAt: inc.occurredAt.toISOString(),
                status: inc.status,
              }))}
            />
          </div>
        </Card>
      )}
    </>
  );
}
