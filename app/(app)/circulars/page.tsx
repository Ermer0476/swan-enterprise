import Link from "next/link";
import { Plus, Megaphone } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { listCirculars } from "@/features/circulars/queries";
import { listAttachmentsForEntities } from "@/features/attachments/queries";
import { CIRCULAR_CATEGORIES, CIRCULAR_SOURCE_LABELS, type CircularSourceValue } from "@/features/circulars/schema";
import { getReferenceList } from "@/lib/reference-list";
import { circularIssuingBodyKey } from "@/lib/reference-registry";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pager } from "@/components/ui/pager";
import { readPage } from "@/lib/pagination";
import { AttachmentQuickView } from "@/components/attachments/attachment-quick-view";
import { formatDate, humanize } from "@/lib/utils";
import type { CircularCategory, CircularSource } from "@/lib/generated/prisma";

const OTHER_LABELS: Partial<Record<CircularSource, string>> = {
  FLAG: "Other Flags",
  CLASS: "Other Class",
  INSURANCE: "Other P&I",
};

export default async function CircularsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("circular:read");
  const sp = await searchParams;
  const activeSource = (sp.source as CircularSource) || undefined;
  const activeCategory = (sp.category as CircularCategory) || undefined;
  const activeIssuingBody = sp.issuingBody || undefined;
  const isArchive = sp.archive === "1";

  // Flag/Class/Insurance circulars are browsed by WHO issued them; Company
  // circulars (and the unfiltered "All" view) are browsed by WHAT they're
  // about. Both facets still exist on every row (see the table below) — this
  // only decides which one gets its own tab row on this page, matching the
  // reviewed structure.
  const showIssuingBodyTabs = activeSource === "FLAG" || activeSource === "CLASS" || activeSource === "INSURANCE";
  // Suggestions are the office-editable reference list now (registry fallback
  // when a company has no rows) — the same source the report form's datalist
  // uses, so the tabs and the "Other" bucket stay in step with it.
  const issuingBodySuggestions = showIssuingBodyTabs
    ? (await getReferenceList(user.companyId, circularIssuingBodyKey(activeSource as CircularSourceValue))).map((o) => o.value)
    : [];

  // SHIPBOARD sees fleet-wide circulars plus their own vessel's targeted
  // ones — never another vessel's. OFFICE stays unrestricted.
  const isShipboard = user.department === "SHIPBOARD";
  const { rows, total, page, totalPages } = await listCirculars(
    user.companyId,
    {
      search: sp.q || undefined,
      source: activeSource,
      category: showIssuingBodyTabs ? undefined : activeCategory,
      issuingBody: showIssuingBodyTabs && activeIssuingBody && activeIssuingBody !== "OTHER" ? activeIssuingBody : undefined,
      issuingBodyNotIn: showIssuingBodyTabs && activeIssuingBody === "OTHER" ? issuingBodySuggestions : undefined,
      archive: isArchive,
      shipboardVesselId: isShipboard ? user.vesselId : undefined,
    },
    readPage(sp),
  );
  const canCreate = can(user, "circular:create");
  const attachmentsByCircular = await listAttachmentsForEntities(
    user.companyId,
    "Circular",
    rows.map((r) => r.id),
  );

  // Source and Archive are only ever chosen from the sidebar flyout — this
  // page's own tabs never touch either, so both are simply preserved as-is
  // whenever a category/issuing-body tab (or the search box) is used.
  function categoryHref(category?: CircularCategory) {
    const params = new URLSearchParams();
    if (sp.q) params.set("q", sp.q);
    if (activeSource) params.set("source", activeSource);
    if (isArchive) params.set("archive", "1");
    if (category) params.set("category", category);
    const qs = params.toString();
    return `/circulars${qs ? `?${qs}` : ""}`;
  }

  function issuingBodyHref(body?: string) {
    const params = new URLSearchParams();
    if (sp.q) params.set("q", sp.q);
    if (activeSource) params.set("source", activeSource);
    if (isArchive) params.set("archive", "1");
    if (body) params.set("issuingBody", body);
    const qs = params.toString();
    return `/circulars${qs ? `?${qs}` : ""}`;
  }

  return (
    <>
      <PageHeader
        title="Circulars"
        description="Flag, Class, Insurance, and Company notices issued to the fleet."
        actions={
          canCreate ? (
            <Link href="/circulars/new">
              <Button><Plus className="h-4 w-4" /> Issue Circular</Button>
            </Link>
          ) : undefined
        }
      />

      {/* Read-only — Source and Archive are only ever changed from the
          sidebar flyout, never from a control on this page. */}
      {(activeSource || isArchive) && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          {activeSource && (
            <>
              <span className="text-muted-foreground">Source:</span>
              <Badge tone="accent">{CIRCULAR_SOURCE_LABELS[activeSource]}</Badge>
            </>
          )}
          {isArchive && <Badge tone="neutral">Archive — issued over a year ago</Badge>}
        </div>
      )}

      {/* No "All" tab on purpose — landing on a source from the sidebar
          flyout already shows everything under it by default, so a separate
          "combine everything" button was just redundant clutter. */}
      {showIssuingBodyTabs ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {issuingBodySuggestions.map((b) => (
            <Link key={b} href={issuingBodyHref(b)} prefetch={false}>
              <Button type="button" variant={activeIssuingBody === b ? "default" : "outline"} size="sm">{b}</Button>
            </Link>
          ))}
          <Link href={issuingBodyHref("OTHER")} prefetch={false}>
            <Button type="button" variant={activeIssuingBody === "OTHER" ? "default" : "outline"} size="sm">
              {OTHER_LABELS[activeSource!]}
            </Button>
          </Link>
        </div>
      ) : (
        <div className="mb-3 flex flex-wrap gap-2">
          {CIRCULAR_CATEGORIES.map((c) => (
            <Link key={c} href={categoryHref(c)} prefetch={false}>
              <Button type="button" variant={activeCategory === c ? "default" : "outline"} size="sm">
                {humanize(c)}
              </Button>
            </Link>
          ))}
        </div>
      )}

      <form className="mb-4 flex flex-wrap items-end gap-2">
        <input type="hidden" name="source" value={sp.source ?? ""} />
        <input type="hidden" name="category" value={sp.category ?? ""} />
        <input type="hidden" name="issuingBody" value={sp.issuingBody ?? ""} />
        <input type="hidden" name="archive" value={sp.archive ?? ""} />
        <div className="min-w-52 flex-1">
          <Input name="q" placeholder="Search ref, title, issuing body, or content…" defaultValue={sp.q ?? ""} />
        </div>
        <Button type="submit" variant="outline">Filter</Button>
      </form>

      {rows.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <Megaphone className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No circulars found</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {canCreate ? "Issue a circular to notify the fleet or a specific vessel." : "No circulars match your filters."}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Ref</th>
                  <th className="px-4 py-2.5 font-medium">Title</th>
                  <th className="px-4 py-2.5 font-medium">Source</th>
                  <th className="px-4 py-2.5 font-medium">Category</th>
                  <th className="px-4 py-2.5 font-medium">Attachment</th>
                  <th className="px-4 py-2.5 font-medium">Distribution</th>
                  <th className="px-4 py-2.5 font-medium">Issued</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-mono text-xs">
                      <Link href={`/circulars/${r.id}`} className="text-accent hover:underline">{r.refNo}</Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <Link href={`/circulars/${r.id}`} className="hover:underline">{r.title}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {CIRCULAR_SOURCE_LABELS[r.source]}{r.issuingBody ? ` — ${r.issuingBody}` : ""}
                    </td>
                    <td className="px-4 py-2.5"><Badge tone="accent">{humanize(r.category)}</Badge></td>
                    <td className="px-4 py-2.5">
                      <AttachmentQuickView
                        attachments={(attachmentsByCircular.get(r.id) ?? []).map((a) => ({
                          id: a.id,
                          fileName: a.fileName,
                          mimeType: a.mimeType,
                        }))}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.vessel?.name ?? "Fleet-wide"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatDate(r.issueDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} totalPages={totalPages} total={total} basePath="/circulars" searchParams={sp} />
        </Card>
      )}
    </>
  );
}
