import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { requireOfficeOrNotFound } from "@/features/crewing/visibility";
import { getSeafarer, listSeafarerService, listVesselOptions } from "@/features/crewing/queries";
import { formatCrewName, vesselLabel } from "@/features/crewing/ui";
import {
  assignmentStatus,
  assignmentStatusTone,
  ASSIGNMENT_STATUS_LABELS,
  daysAboard,
} from "@/features/crewing/status";
import { rankLabel } from "@/lib/crew-ranks";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { SeafarerRowActions } from "./seafarer-row-actions";
import { CrewChangePanel } from "./crew-change-panel";

/**
 * One seafarer's record. Office only, and the ONE surface in this module where
 * the restricted tier is read — `getSeafarer` picks the tier from the session
 * and returns a discriminated union, so the personal-details card is behind
 * `detail.tier === "RESTRICTED"` and the compiler will not let it render
 * otherwise.
 *
 * The current vessel is at the top and the service history below it, and both
 * come from the SAME query over `CrewAssignment` — the current one is simply
 * the row with no `actualSignOffDate`. Deriving it rather than storing it is
 * what makes the two impossible to contradict, and why "which ship was he on in
 * March" survives every crew change after it.
 */
export default async function SeafarerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("crew:read");
  requireOfficeOrNotFound(user);

  const { id } = await params;
  const canAssign = can(user, "crew:assign");
  const [detail, service, vessels] = await Promise.all([
    getSeafarer(user, id),
    listSeafarerService(user, id),
    // The vessels a sign-on / transfer may name. Only fetched for a caller who
    // can record crew changes — nobody else sees the controls.
    canAssign ? listVesselOptions(user.companyId) : Promise.resolve([]),
  ]);
  if (!detail) notFound();

  const s = detail.seafarer;
  const canEdit = can(user, "crew:update");
  const canDelete = can(user, "crew:delete");

  // The live assignment — at most one aboard, by the invariant the crew-change
  // actions enforce. `now` is read once and passed into every derived value.
  const current = service.find((a) => a.actualSignOffDate === null);
  const now = new Date();

  // What the crew-change panel needs from the open assignment: its id and lock,
  // and the derived status that decides which controls appear.
  const currentForPanel =
    current && current.actualSignOffDate === null
      ? {
          id: current.id,
          updatedAt: current.updatedAt.toISOString(),
          vesselId: current.vessel.id,
          status: (current.actualSignOnDate ? "ABOARD" : "PLANNED") as "ABOARD" | "PLANNED",
        }
      : null;

  return (
    <div className="mx-auto max-w-7xl">
      <Link
        href="/crewing/seafarers"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Seafarer Register
      </Link>
      <PageHeader
        title={formatCrewName(s, "prose")}
        description={s.crewCode ? `Crew code ${s.crewCode}` : "No crew code recorded"}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={s.active ? "success" : "neutral"}>
              {s.active ? "Employed" : "Left the company"}
            </Badge>
            {canEdit && (
              <Link href={`/crewing/seafarers/${s.id}/edit`}>
                <Button variant="outline">
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
              </Link>
            )}
          </div>
        }
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Current assignment</CardTitle>
        </CardHeader>
        <CardContent>
          {current ? (
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Vessel</dt>
                <dd className="mt-0.5 text-sm font-medium">{vesselLabel(current.vessel)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Rank</dt>
                <dd className="mt-0.5 text-sm font-medium">{rankLabel(current.rankCode)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {current.actualSignOnDate ? "Signed on" : "Planned sign-on"}
                </dt>
                <dd className="mt-0.5 text-sm font-medium">
                  {formatDate(current.actualSignOnDate ?? current.plannedSignOnDate)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Due off</dt>
                <dd className="mt-0.5 text-sm font-medium">
                  {current.plannedSignOffDate ? formatDate(current.plannedSignOffDate) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Status</dt>
                <dd className="mt-0.5">
                  <Badge tone={assignmentStatusTone(assignmentStatus(current))}>
                    {ASSIGNMENT_STATUS_LABELS[assignmentStatus(current)]}
                  </Badge>
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              Not assigned to a vessel — he is in the shore pool. A vessel can be recorded when he
              joins one; nothing about the ship is held on his own record.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Identity</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {(
              [
                ["Surname", s.lastName],
                ["First name", s.firstName],
                ["Middle name", s.middleName ?? "—"],
                ["Suffix", s.suffix ?? "—"],
                ["Crew code", s.crewCode ?? "—"],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
                <dd className="mt-0.5 text-sm font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {detail.tier === "RESTRICTED" ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Personal details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {detail.seafarer.redactedAt && (
              <p className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                The personal data on this record was redacted on{" "}
                {formatDate(detail.seafarer.redactedAt)}. The employment record is kept; the personal
                details are gone and cannot be restored.
              </p>
            )}
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {(
                [
                  ["Nationality", detail.seafarer.nationality ?? "—"],
                  ["Date of birth", detail.seafarer.dateOfBirth ? formatDate(detail.seafarer.dateOfBirth) : "—"],
                  ["Personal phone", detail.seafarer.contactPhone ?? "—"],
                  ["Personal email", detail.seafarer.contactEmail ?? "—"],
                  ["Next of kin", detail.seafarer.nextOfKinName ?? "—"],
                  ["Relationship", detail.seafarer.nextOfKinRelationship ?? "—"],
                  ["Next of kin phone", detail.seafarer.nextOfKinPhone ?? "—"],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
                  <dd className="mt-0.5 text-sm font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="max-w-prose text-xs leading-relaxed text-muted-foreground">
              Personal data under the Data Privacy Act, visible to the crewing desk only. The next of
              kin is a separate person whose details are held for emergency use, and who will be told
              so on request.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-6">
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">
              This record holds personal details that your role does not include. They were not sent
              to this page.
            </p>
          </CardContent>
        </Card>
      )}

      {/**
        * ── WHERE "WHO WAS ABOARD IN MARCH" IS ANSWERED ──
        * Every tour of duty keeps the ship it was always about. Nothing on this
        * table is rewritten by a later crew change.
        */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Service history</CardTitle>
        </CardHeader>
        {service.length === 0 ? (
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No tours of duty recorded. A vessel appears here once an assignment has been filed
              against one.
            </p>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Vessel</th>
                  <th className="px-4 py-2.5 font-medium">Rank</th>
                  <th className="px-4 py-2.5 font-medium">Signed on</th>
                  <th className="px-4 py-2.5 font-medium">Signed off</th>
                  <th className="px-4 py-2.5 font-medium">Days</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {service.map((a) => {
                  const status = assignmentStatus(a);
                  const days = daysAboard(a, now);
                  return (
                    <tr key={a.id} className="border-b border-border last:border-0">
                      <td className="whitespace-nowrap px-4 py-2.5 font-medium">
                        {vesselLabel(a.vessel)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5">{rankLabel(a.rankCode)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                        {a.actualSignOnDate
                          ? formatDate(a.actualSignOnDate)
                          : `Planned ${formatDate(a.plannedSignOnDate)}`}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                        {a.actualSignOffDate ? formatDate(a.actualSignOffDate) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{days ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        <Badge tone={assignmentStatusTone(status)}>
                          {ASSIGNMENT_STATUS_LABELS[status]}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {canAssign && (
        <div className="mb-6">
          <CrewChangePanel
            seafarerId={s.id}
            seafarerUpdatedAt={s.updatedAt.toISOString()}
            current={currentForPanel}
            vessels={vessels}
          />
        </div>
      )}

      {(canEdit || canDelete) && (
        <SeafarerRowActions
          seafarerId={s.id}
          active={s.active}
          updatedAt={s.updatedAt.toISOString()}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      )}
    </div>
  );
}
