import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";

/**
 * Server-rendered numbered pager for a list page — no client JS, matches the
 * house pattern of GET-form/link-driven filters (see the KPI period
 * selectors). Renders nothing when there's only one page, so a module with
 * little data today shows no pager until it actually needs one.
 *
 * Every page link is built from the page's own `searchParams` MINUS `page`, so
 * the active search/status/vessel filter rides along on every jump and is
 * never dropped when the reader changes pages. Page 1's link omits `?page`
 * entirely, keeping the canonical first-page URL clean.
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
      <div className="flex items-center gap-1.5">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} aria-label="Previous page">
            <Button variant="outline" size="sm"><ChevronLeft className="h-4 w-4" /> Prev</Button>
          </Link>
        ) : (
          <Button variant="outline" size="sm" disabled><ChevronLeft className="h-4 w-4" /> Prev</Button>
        )}

        {pageWindow(page, totalPages).map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} className="px-1.5 text-muted-foreground" aria-hidden>
              …
            </span>
          ) : p === page ? (
            <Button key={p} variant="default" size="sm" aria-current="page" disabled>
              {p}
            </Button>
          ) : (
            <Link key={p} href={hrefFor(p)} aria-label={`Page ${p}`}>
              <Button variant="outline" size="sm">{p}</Button>
            </Link>
          ),
        )}

        {page < totalPages ? (
          <Link href={hrefFor(page + 1)} aria-label="Next page">
            <Button variant="outline" size="sm">Next <ChevronRight className="h-4 w-4" /></Button>
          </Link>
        ) : (
          <Button variant="outline" size="sm" disabled>Next <ChevronRight className="h-4 w-4" /></Button>
        )}
      </div>
    </div>
  );
}

/**
 * The list of page tokens to render: always the first and last page, a window
 * of one page either side of the current page, and a single "…" standing in
 * for each gap. So 1 … 4 5 6 … 20, and no ellipsis when the pages are already
 * contiguous (1 2 3 4 5). `current` is trusted to be within [1, totalPages] —
 * the query clamps an out-of-range `?page=` to the last page before it gets
 * here.
 */
function pageWindow(current: number, totalPages: number): (number | "…")[] {
  const keep = new Set<number>([1, totalPages, current - 1, current, current + 1]);
  const pages = [...keep].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);

  const out: (number | "…")[] = [];
  let prev = 0;
  for (const p of pages) {
    if (prev && p - prev > 1) out.push("…");
    out.push(p);
    prev = p;
  }
  return out;
}
