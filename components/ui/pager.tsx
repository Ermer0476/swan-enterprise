import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";

/**
 * Server-rendered Prev/Next pager for a list page — no client JS, matches
 * the house pattern of GET-form/link-driven filters (see the KPI period
 * selectors). Renders nothing when there's only one page, so a module with
 * little data today shows no pager until it actually needs one.
 */
export function Pager({
  page,
  totalPages,
  total,
  basePath,
  searchParams,
}: {
  page: number;
  totalPages: number;
  total: number;
  basePath: string;
  searchParams: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  const hrefFor = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (v && k !== "page") params.set(k, v);
    }
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm">
      <span className="text-muted-foreground">
        Page {page} of {totalPages} · {total} total
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)}>
            <Button variant="outline" size="sm"><ChevronLeft className="h-4 w-4" /> Prev</Button>
          </Link>
        ) : (
          <Button variant="outline" size="sm" disabled><ChevronLeft className="h-4 w-4" /> Prev</Button>
        )}
        {page < totalPages ? (
          <Link href={hrefFor(page + 1)}>
            <Button variant="outline" size="sm">Next <ChevronRight className="h-4 w-4" /></Button>
          </Link>
        ) : (
          <Button variant="outline" size="sm" disabled>Next <ChevronRight className="h-4 w-4" /></Button>
        )}
      </div>
    </div>
  );
}
