/**
 * Shared list-page pagination helper. A queries.ts list function that grows
 * unbounded (no `take`) is fine on a seeded demo dataset but becomes a
 * full-table fetch once a module has years of real fleet data — every
 * paginated list query in the app should build its Prisma args from
 * `paginationArgs` and wrap its result with `paginate`, so query.ts and
 * page.tsx both stay in the same shape module to module (see
 * components/ui/pager.tsx for the matching list-page UI).
 */
export const DEFAULT_PAGE_SIZE = 30;

export type Paginated<T> = {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/** `{ skip, take }` for a Prisma `findMany` call — page is 1-indexed and
 * clamped to at least 1 so a stray `?page=0` or `?page=-3` in the URL can't
 * produce a negative `skip`. */
export function paginationArgs(page: number, pageSize: number = DEFAULT_PAGE_SIZE) {
  const safePage = Math.max(1, Math.floor(page) || 1);
  return { skip: (safePage - 1) * pageSize, take: pageSize };
}

export function paginate<T>(rows: T[], total: number, page: number, pageSize: number = DEFAULT_PAGE_SIZE): Paginated<T> {
  const safePage = Math.max(1, Math.floor(page) || 1);
  return { rows, total, page: safePage, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Reads `?page=` from a list page's resolved searchParams — every list page
 * takes the same shape here so this is one line instead of repeating the
 * parse/clamp logic per module. */
export function readPage(searchParams: Record<string, string | undefined>): number {
  const n = Number(searchParams.page);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}
