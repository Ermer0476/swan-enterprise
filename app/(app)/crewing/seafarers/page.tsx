import Link from "next/link";
import { Plus, Users, ArrowLeft, Upload } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { requireOfficeOrNotFound } from "@/features/crewing/visibility";
import { listSeafarers } from "@/features/crewing/queries";
import { formatCrewName, vesselLabel } from "@/features/crewing/ui";
import { SEAFARER_ACTIVE_FILTERS, type SeafarerActiveFilter } from "@/features/crewing/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pager } from "@/components/ui/pager";
import { readPage } from "@/lib/pagination";
import { formatDate } from "@/lib/utils";

/**
 * The seafarer register — OFFICE ONLY, and gated twice on purpose (§5.1):
 * `requireOfficeOrNotFound` here, and the ship not holding crew:create /
 * crew:update / crew:read-sensitive at all. A Ship Officer opening this URL
 * gets a 404, not a 403 — a 403 would confirm the page exists, which is the
 * one thing the refusal is meant not to say.
 *
 * The list is the OPERATIONAL tier for everyone, including the Crewing
 * Manager. A register is a browse surface — read over a shoulder, left open,
 * printed — and a man's date of birth belongs on the record somebody
 * deliberately opened, not in a table of 150 rows.
 */
export default async function SeafarerRegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("crew:read");
  requireOfficeOrNotFound(user);

  const sp = await searchParams;
  const active = (SEAFARER_ACTIVE_FILTERS as readonly string[]).includes(sp.active ?? "")
    ? (sp.active as SeafarerActiveFilter)
    : "ACTIVE";

  const { rows, total, page, totalPages } = await listSeafarers(
    user,
    { search: sp.q || undefined, active },
    readPage(sp),
  );
  const canCreate = can(user, "crew:create");
  // Importing a manifest both creates seafarers and embarks them, so it needs
  // crew:assign as well — same rule the import actions enforce.
  const canImport = canCreate && can(user, "crew:assign");

  return (
    <>
      <Link
        href="/crewing"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Crewing
      </Link>

      <PageHeader
        title="Seafarer Register"
        description="The people the company employs at sea. The office owns the person; the ship owns the event."
        actions={
          canCreate ? (
            <div className="flex flex-wrap items-center gap-2">
              {canImport && (
                <Link href="/crewing/import">
                  <Button variant="outline">
                    <Upload className="h-4 w-4" /> Import manifest
                  </Button>
                </Link>
              )}
              <Link href="/crewing/seafarers/new">
                <Button>
                  <Plus className="h-4 w-4" /> Add Seafarer
                </Button>
              </Link>
            </div>
          ) : undefined
        }
      />

      <form className="mb-4 flex flex-wrap items-end gap-2">
        <div className="min-w-52 flex-1">
          <Input
            name="q"
            aria-label="Search by name or crew code"
            placeholder="Search by name or crew code…"
            defaultValue={sp.q ?? ""}
          />
        </div>
        <Select name="active" defaultValue={active} className="w-44" aria-label="Employment">
          {SEAFARER_ACTIVE_FILTERS.map((f) => (
            <option key={f} value={f}>
              {f === "ALL" ? "Everyone" : f === "ACTIVE" ? "Employed" : "Left the company"}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>

      {rows.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <Users className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No seafarers in the register</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {canCreate
              ? "Add the men currently aboard to get started."
              : "No seafarers match your filters."}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Crew code</th>
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Vessel</th>
                  {/* "Employment", not "Manning pool". Seafarer.active means still employed
                      by the company; it does NOT mean ashore between contracts. Labelled
                      as a pool it read as a contradiction on the one row that matters —
                      a man showing "Aboard since 12 Mar 2026" and "In the pool" on the
                      same line, which is two different senses of the word on one screen. */}
                  <th className="px-4 py-2.5 font-medium">Employment</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  /**
                   * ── THE ANSWER TO THE CLIENT'S QUESTION ──
                   * *"Para malaman kung anong vessel sila nakasampa."* It is
                   * DERIVED, on every render, from the live assignment the
                   * query nested — never read from the man's own row, which
                   * carries no vessel and never will. `assignments` holds at
                   * most one element: the query filters to the live one and
                   * takes one.
                   */
                  const current = s.assignments[0];
                  return (
                    <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-2.5 font-mono text-xs">{s.crewCode ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        <Link href={`/crewing/seafarers/${s.id}`} className="text-accent hover:underline">
                          {formatCrewName(s)}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">
                        {current ? (
                          <>
                            <div className="whitespace-nowrap font-medium">
                              {vesselLabel(current.vessel)}
                            </div>
                            <div className="whitespace-nowrap text-xs text-muted-foreground">
                              {current.actualSignOnDate
                                ? `Aboard since ${formatDate(current.actualSignOnDate)}`
                                : `Joining ${formatDate(current.plannedSignOnDate)}`}
                            </div>
                          </>
                        ) : (
                          // Not "—". A man between contracts is a real state
                          // the register is meant to hold, and a dash reads as
                          // missing data — which is what sends somebody looking
                          // for the vessel that was never meant to be there.
                          <span className="text-muted-foreground">Not assigned</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge tone={s.active ? "success" : "neutral"}>
                          {s.active ? "Employed" : "Left the company"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pager
            page={page}
            totalPages={totalPages}
            total={total}
            basePath="/crewing/seafarers"
            searchParams={sp}
          />
        </Card>
      )}
    </>
  );
}
