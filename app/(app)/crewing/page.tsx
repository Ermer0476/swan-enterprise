import Link from "next/link";
import { Users } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { listCrewAssignments, listVesselOptions } from "@/features/crewing/queries";
import { formatCrewName, vesselLabel } from "@/features/crewing/ui";
import {
  assignmentStatus,
  assignmentStatusTone,
  ASSIGNMENT_STATUS_LABELS,
  daysAboard,
} from "@/features/crewing/status";
import { rankLabel, rankSeniority } from "@/lib/crew-ranks";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

/**
 * The crew list — ONE page, discriminated server-side on `department`.
 *
 * Ship: its own vessel's crew, and no vessel picker — the boundary already
 * decided that. Office: the fleet, with a `?vessel=` filter.
 *
 * The list stays a browse surface: the crew-change controls live on the
 * seafarer's own record (which holds the optimistic-lock tokens), and the
 * office gets a per-row link into them rather than a form inline in the table.
 *
 * Nothing on this page is a sensitive field. The seafarer arrives through
 * `listCrewAssignments`'s nested OPERATIONAL select, so a date of birth is not
 * merely unrendered — it is not in the query, not in the RSC payload, not in
 * the type.
 */
export default async function CrewingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("crew:read");
  const sp = await searchParams;
  const isShipboard = user.department === "SHIPBOARD";
  const scope = sp.scope === "ALL" ? "ALL" : "ABOARD";

  // A shipboard caller's vessel is imposed by crewAssignmentScopeFor whatever
  // this says; passing it would be theatre. The office's picker is real.
  const vesselFilter = isShipboard ? undefined : sp.vessel || undefined;

  const [rows, vessels] = await Promise.all([
    listCrewAssignments(user, { vesselId: vesselFilter, scope }),
    isShipboard ? Promise.resolve([]) : listVesselOptions(user.companyId),
  ]);

  // `now` is computed once, on the server, and passed into every derived value.
  const now = new Date();

  // Rank seniority is a code map (lib/crew-ranks.ts), not a database column, so
  // the ordering that matters to a Master happens here, not in the query.
  const ordered = [...rows].sort((a, b) => {
    const rank = rankSeniority(a.rankCode) - rankSeniority(b.rankCode);
    if (rank !== 0) return rank;
    return a.seafarer.lastName.localeCompare(b.seafarer.lastName);
  });

  const canSeeRegister = !isShipboard && can(user, "crew:read");
  const canManage = !isShipboard && can(user, "crew:assign");

  return (
    <>
      <PageHeader
        title="Crewing"
        description={
          isShipboard
            ? "Who is aboard this vessel, in what rank, and since when."
            : "The fleet's crew — who is aboard which ship, in what rank, and since when."
        }
        actions={
          canSeeRegister ? (
            <Link href="/crewing/seafarers">
              <Button variant="outline">
                <Users className="h-4 w-4" /> Seafarer Register
              </Button>
            </Link>
          ) : undefined
        }
      />

      <form className="mb-4 flex flex-wrap items-end gap-2">
        {!isShipboard && (
          <Select name="vessel" defaultValue={sp.vessel ?? ""} className="w-52" aria-label="Vessel">
            <option value="">All vessels</option>
            {vessels.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
        )}
        <Select name="scope" defaultValue={scope} className="w-52" aria-label="Which crew">
          <option value="ABOARD">Currently aboard</option>
          <option value="ALL">All assignments, past and present</option>
        </Select>
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>

      {ordered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <Users className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">
            {scope === "ABOARD" ? "Nobody is recorded as aboard" : "No crew assignments recorded"}
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            A seafarer appears here once a crew change has been recorded against a vessel.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Rank</th>
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Crew code</th>
                  {!isShipboard && <th className="px-4 py-2.5 font-medium">Vessel</th>}
                  <th className="px-4 py-2.5 font-medium">Signed on</th>
                  <th className="px-4 py-2.5 font-medium">Days</th>
                  <th className="px-4 py-2.5 font-medium">Due off</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  {canManage && <th className="px-4 py-2.5 font-medium">Crew change</th>}
                </tr>
              </thead>
              <tbody>
                {ordered.map((row) => {
                  const status = assignmentStatus(row);
                  const days = daysAboard(row, now);
                  return (
                    <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="whitespace-nowrap px-4 py-2.5">{rankLabel(row.rankCode)}</td>
                      <td className="px-4 py-2.5 font-medium">
                        {canSeeRegister ? (
                          <Link
                            href={`/crewing/seafarers/${row.seafarer.id}`}
                            className="hover:underline"
                          >
                            {formatCrewName(row.seafarer)}
                          </Link>
                        ) : (
                          formatCrewName(row.seafarer)
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                        {row.seafarer.crewCode ?? "—"}
                      </td>
                      {!isShipboard && (
                        <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{vesselLabel(row.vessel)}</td>
                      )}
                      <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                        {row.actualSignOnDate ? formatDate(row.actualSignOnDate) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{days ?? "—"}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                        {row.plannedSignOffDate ? formatDate(row.plannedSignOffDate) : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge tone={assignmentStatusTone(status)}>{ASSIGNMENT_STATUS_LABELS[status]}</Badge>
                      </td>
                      {canManage && (
                        <td className="whitespace-nowrap px-4 py-2.5">
                          <Link
                            href={`/crewing/seafarers/${row.seafarer.id}`}
                            className="text-sm font-medium text-accent hover:underline"
                          >
                            {status === "ABOARD"
                              ? "Sign off / transfer"
                              : status === "PLANNED"
                                ? "Confirm sign-on"
                                : "Manage"}
                          </Link>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
