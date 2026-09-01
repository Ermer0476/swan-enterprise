import "server-only";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";
import type { Prisma } from "@/lib/generated/prisma";
import { can } from "@/lib/rbac";
import { crewAssignmentScopeFor } from "./visibility";
import type { SeafarerActiveFilter } from "./schema";

/**
 * ── EVERY SELECT IN THIS FILE IS EXPLICIT, AND THAT IS THE WHOLE CONTROL ──
 *
 * features/users/queries.ts opens with the same rule for `passwordHash`. This
 * module raises it from a habit to a compile error. Three rules, non-negotiable
 * (docs/plans/crewing.md §5.3):
 *
 *  1. NO `include` AND NO BARE MODEL READ ANYWHERE IN THIS FILE. Every read
 *     names its columns. A single `findFirst` with no `select` puts a date of
 *     birth, a personal phone number and a next of kin's name into the RSC
 *     payload the browser can read — not "renders them", SHIPS them.
 *  2. THE TIER IS CHOSEN SERVER-SIDE FROM THE SESSION, ONCE, IN THE QUERY.
 *     Never a `tier` parameter: that would be a caller-supplied privilege,
 *     which is the same mistake as trusting the UI. `can()` is used here as a
 *     server-side decision, not as the display-only check lib/rbac.ts warns
 *     about — the result never leaves the server, and a caller without the key
 *     gets a NARROWER OBJECT rather than an error.
 *  3. The ship reaches a seafarer only THROUGH an assignment, so the crew list
 *     nests its seafarer select inside the assignment query and applies the
 *     boundary and the field tier in one statement.
 */

/**
 * Operational tier. Safe for a Master, safe on a printed crew list.
 *
 * `crewCode` is here deliberately, and it is the only disambiguator the ship
 * gets: two "Juan Dela Cruz" is entirely normal in a Philippine crew register,
 * and the office's other disambiguator — the date of birth — is a field the
 * Master must not see (§14 R6).
 */
const SEAFARER_OPERATIONAL_SELECT = {
  id: true,
  crewCode: true,
  lastName: true,
  firstName: true,
  middleName: true,
  suffix: true,
  active: true,
  // Bookkeeping, not personal data, and it is in the operational tier because
  // every edit form and every state-changing action needs it: `updatedAt` IS
  // the optimistic lock (STALE_RECORD_MESSAGE). Omitting it would mean a form
  // could not prove which version it was rendered from.
  updatedAt: true,
} as const;

/**
 * Restricted tier — SUPERSET, office only, gated on `crew:read-sensitive`.
 *
 * Every field added here is Sensitive-class under §3.1. Adding one is a
 * data-protection decision, not a UI convenience: state the classification in
 * the PR, and add the column to `CREW_AUDIT_EXCLUDE` (audit.ts) in the same
 * commit, or the audit trail becomes the copy this module cannot redact.
 */
const SEAFARER_RESTRICTED_SELECT = {
  ...SEAFARER_OPERATIONAL_SELECT,
  nationality: true,
  dateOfBirth: true,
  contactPhone: true,
  contactEmail: true,
  nextOfKinName: true,
  nextOfKinRelationship: true,
  nextOfKinPhone: true,
  redactedAt: true,
} as const;

/**
 * `SeafarerOperational` HAS NO `dateOfBirth` PROPERTY. A component handed one
 * and asked to render `seafarer.dateOfBirth` fails `npm run typecheck`, and
 * with `noUncheckedIndexedAccess` and no `any` there is no cheap way around
 * it. The restricted columns are not merely hidden from the UI — they are not
 * in the SQL, not in the RSC payload, and not in the type.
 */
export type SeafarerOperational = Prisma.SeafarerGetPayload<{
  select: typeof SEAFARER_OPERATIONAL_SELECT;
}>;
export type SeafarerRestricted = Prisma.SeafarerGetPayload<{
  select: typeof SEAFARER_RESTRICTED_SELECT;
}>;

/**
 * One record, at the tier the session earns.
 *
 * A DISCRIMINATED union, not a bare `A | B`. `SeafarerRestricted` is
 * structurally assignable to `SeafarerOperational` (it is a superset), so a
 * plain union would let a caller treat every result as operational and lose
 * the distinction the type exists to make. Switching on `tier` is what forces
 * a component to prove it is allowed to be looking at a date of birth.
 */
export type SeafarerDetail =
  | { tier: "OPERATIONAL"; seafarer: SeafarerOperational }
  | { tier: "RESTRICTED"; seafarer: SeafarerRestricted };

export type SeafarerFilters = { search?: string; active?: SeafarerActiveFilter };

function activeWhere(filter: SeafarerActiveFilter | undefined): Prisma.SeafarerWhereInput {
  if (filter === "ACTIVE") return { active: true };
  if (filter === "INACTIVE") return { active: false };
  return {};
}

function searchWhere(search: string | undefined): Prisma.SeafarerWhereInput {
  if (!search) return {};
  // Name or crew code. Postgres supports `mode: "insensitive"`, which the
  // SQLite era did not — see CLAUDE.md.
  return {
    OR: [
      { lastName: { contains: search, mode: "insensitive" } },
      { firstName: { contains: search, mode: "insensitive" } },
      { crewCode: { contains: search, mode: "insensitive" } },
    ],
  };
}

/**
 * The register's Vessel column — the client's actual request: *"para malaman
 * kung anong vessel sila nakasampa."*
 *
 * ── DERIVED FROM THE ASSIGNMENT, AND THERE IS NO OTHER WAY TO DO IT ──
 * `Seafarer` has no `vesselId` and never will (§5.1). "Which ship is he on" is
 * therefore a question about his LIVE assignment — `actualSignOffDate: null`
 * and `deletedAt: null` — read through the relation on every list render. A
 * column on `Seafarer` would answer this one question and destroy "who was
 * aboard in March", which exposure hours, an incident investigation and a
 * vetting inspector all actually ask.
 *
 * `take: 1` is safe because a seafarer may hold at most ONE live assignment —
 * the invariant createSeafarerAction enforces (§6.2). The orderBy is on
 * `plannedSignOnDate`, which is non-nullable and therefore deterministic, so
 * historical data that predates the invariant renders the most recent intent
 * rather than an arbitrary row.
 *
 * ── THE FIELDS ARE OPERATIONAL, WHICH IS WHY THIS BELONGS IN A LIST ──
 * A vessel name, a vessel code, a rank and a sign-on date are the operational
 * tier (§5.4): safe for a Master, safe printed, safe read over a shoulder.
 * Nothing here widens the list to the restricted tier, and nothing may.
 */
const CURRENT_ASSIGNMENT_SELECT = {
  where: { deletedAt: null, actualSignOffDate: null },
  select: {
    id: true,
    rankCode: true,
    plannedSignOnDate: true,
    actualSignOnDate: true,
    plannedSignOffDate: true,
    actualSignOffDate: true,
    vessel: { select: { id: true, name: true, code: true } },
  },
  orderBy: { plannedSignOnDate: "desc" },
  take: 1,
} as const;

const SEAFARER_REGISTER_SELECT = {
  ...SEAFARER_OPERATIONAL_SELECT,
  assignments: CURRENT_ASSIGNMENT_SELECT,
} as const;

export type SeafarerRegisterRow = Prisma.SeafarerGetPayload<{
  select: typeof SEAFARER_REGISTER_SELECT;
}>;

/**
 * The office's register.
 *
 * OPERATIONAL TIER FOR EVERYONE, INCLUDING THE CREWING MANAGER, AND THAT IS
 * DELIBERATE — a narrowing on the plan's §5.3, not an oversight. A list is a
 * BROWSE surface: it is read over the shoulder, left open on a screen, and
 * printed. The restricted tier is read one man at a time, on the record
 * somebody deliberately opened, which is what `getSeafarer` is for. Nothing in
 * this batch renders a sensitive column in a list, so nothing in this batch
 * ships one to a browser.
 *
 * No pagination and no `take`: the register is 100–150 people (§14 R7). Do not
 * copy Voyage Reports' pagination here — copy its select discipline instead.
 *
 * NO VESSEL BOUNDARY ON THE NESTED ASSIGNMENT, deliberately: this query returns
 * the whole register, so the boundary that protects it is the DEPARTMENT, and
 * the page enforces it with `requireOfficeOrNotFound` before asking — the same
 * boundary, stated the same way, as `getSeafarer` and `findSeafarerForOffice`.
 * Filtering the nested vessel while every parent row is unfiltered would
 * protect nothing that gate does not already protect.
 */
export async function listSeafarers(
  user: SessionUser,
  filters: SeafarerFilters = {},
): Promise<SeafarerRegisterRow[]> {
  return prisma.seafarer.findMany({
    where: {
      companyId: user.companyId,
      deletedAt: null,
      ...activeWhere(filters.active),
      ...searchWhere(filters.search),
    },
    select: SEAFARER_REGISTER_SELECT,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

/**
 * One seafarer, at the tier the session earns. Returns null for *doesn't
 * exist*, *isn't yours* and *already deleted* alike.
 *
 * There is no vessel boundary to apply: `Seafarer` has no `vesselId` and never
 * will (§5.1). The boundary for this table is the department, and the caller —
 * a page — enforces it with `requireOfficeOrNotFound` (visibility.ts) before
 * asking.
 */
export async function getSeafarer(user: SessionUser, id: string): Promise<SeafarerDetail | null> {
  const where = { id, companyId: user.companyId, deletedAt: null };

  // The tier decision. One line, one place, server-side, from the session.
  if (can(user, "crew:read-sensitive")) {
    const seafarer = await prisma.seafarer.findFirst({ where, select: SEAFARER_RESTRICTED_SELECT });
    return seafarer ? { tier: "RESTRICTED", seafarer } : null;
  }
  const seafarer = await prisma.seafarer.findFirst({ where, select: SEAFARER_OPERATIONAL_SELECT });
  return seafarer ? { tier: "OPERATIONAL", seafarer } : null;
}

/**
 * The crew list — one row per assignment, and the ONLY route a ship has to a
 * seafarer's data.
 *
 * The seafarer is reached through a nested select on the assignment, so the
 * vessel boundary and the field tier are applied in a single statement. The
 * nested select is the OPERATIONAL one unconditionally, for the same reason
 * `listSeafarers` is: a crew list is a browse surface, and nothing on it is a
 * sensitive column.
 *
 * `orderBy` is the assignment's dates; rank seniority is applied in the page,
 * because RANK_SENIORITY is a code map and not a database column.
 */
const CREW_ASSIGNMENT_LIST_SELECT = {
  id: true,
  rankCode: true,
  vesselId: true,
  plannedSignOnDate: true,
  actualSignOnDate: true,
  plannedSignOffDate: true,
  actualSignOffDate: true,
  signOnPort: true,
  signOffPort: true,
  // Code as well as name: vesselLabel() renders "Swan Aquarius (SWA)" on the
  // seafarer register and on the detail page, and showing the vessel two
  // different ways on two adjacent crewing screens reads as two different
  // things rather than one formatting choice.
  vessel: { select: { id: true, name: true, code: true } },
  seafarer: { select: SEAFARER_OPERATIONAL_SELECT },
} as const;

export type CrewAssignmentListRow = Prisma.CrewAssignmentGetPayload<{
  select: typeof CREW_ASSIGNMENT_LIST_SELECT;
}>;

export type CrewListFilters = {
  /** Office only; a shipboard caller's own vessel is imposed by the boundary
   *  regardless of what this says. */
  vesselId?: string;
  /** ABOARD only (the default question — "who is on my ship right now") or the
   *  vessel's whole history. */
  scope?: "ABOARD" | "ALL";
};

export async function listCrewAssignments(
  user: SessionUser,
  filters: CrewListFilters = {},
): Promise<CrewAssignmentListRow[]> {
  return prisma.crewAssignment.findMany({
    where: {
      companyId: user.companyId,
      deletedAt: null,
      // AND, never a spread — a spread would silently drop either the
      // boundary or the filter beside it. See lib/vessel-scope.ts.
      AND: [crewAssignmentScopeFor(user)],
      ...(filters.vesselId ? { vesselId: filters.vesselId } : {}),
      // "Aboard" is `actualSignOffDate: null` AND actually joined — a planned
      // assignment has neither date and is nobody's crew yet.
      ...(filters.scope === "ALL"
        ? {}
        : { actualSignOffDate: null, actualSignOnDate: { not: null } }),
    },
    select: CREW_ASSIGNMENT_LIST_SELECT,
    orderBy: [{ actualSignOnDate: "desc" }, { plannedSignOnDate: "desc" }],
  });
}

/**
 * One man's service history — every tour of duty, newest first.
 *
 * THIS IS WHERE "WHERE WAS HE IN MARCH" IS ANSWERED, and it is answered
 * because the vessel lives on the assignment: each row keeps the ship it was
 * always about, and no later crew change rewrites it. The current vessel is
 * derived from this same list (the row with no `actualSignOffDate`) rather than
 * fetched separately, so the header and the history cannot disagree.
 *
 * No seafarer columns are selected at all — the caller already holds the man at
 * the tier it earned, and a nested `seafarer` here would be a second read at no
 * tier. The vessel boundary applies in full: this is a `CrewAssignment` query,
 * and `AND: [crewAssignmentScopeFor(user)]` is how this module states it.
 */
const SEAFARER_SERVICE_SELECT = {
  id: true,
  rankCode: true,
  plannedSignOnDate: true,
  actualSignOnDate: true,
  plannedSignOffDate: true,
  actualSignOffDate: true,
  signOnPort: true,
  signOffPort: true,
  // Operational bookkeeping, not personal data: `updatedAt` is the optimistic
  // lock the crew-change controls (sign-off, transfer) submit — the same reason
  // it sits in SEAFARER_OPERATIONAL_SELECT. Without it the detail page could not
  // prove which version of the current assignment a control was rendered from.
  updatedAt: true,
  vessel: { select: { id: true, name: true, code: true } },
} as const;

export type SeafarerServiceRow = Prisma.CrewAssignmentGetPayload<{
  select: typeof SEAFARER_SERVICE_SELECT;
}>;

export async function listSeafarerService(
  user: SessionUser,
  seafarerId: string,
): Promise<SeafarerServiceRow[]> {
  return prisma.crewAssignment.findMany({
    where: {
      companyId: user.companyId,
      seafarerId,
      deletedAt: null,
      // AND, never a spread — see lib/vessel-scope.ts.
      AND: [crewAssignmentScopeFor(user)],
    },
    select: SEAFARER_SERVICE_SELECT,
    orderBy: [{ plannedSignOnDate: "desc" }, { actualSignOnDate: "desc" }],
  });
}

/** Active vessels, for the office's crew-list filter and the register's
 *  first-assignment picker. Same shape as features/exposure-hours/queries.ts's
 *  own, plus `code`: the fleet code is what appears in every reference number,
 *  and the client asked for the name and the code together. */
export async function listVesselOptions(companyId: string) {
  return prisma.vessel.findMany({
    where: { companyId, deletedAt: null, status: "ACTIVE" },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });
}

/**
 * The login account linked to a seafarer, if any — id and email only.
 *
 * A DEDICATED loader, deliberately NOT a field on `SEAFARER_OPERATIONAL_SELECT`:
 * that select is nested inside the crew-list query a Master reads, and a login
 * email must not ride onto a ship's crew list ("safe on a printed crew list").
 * This runs once, on the office-only seafarer record, behind admin:manage-users.
 * Company-scoped; a foreign or deleted seafarer reads as no link.
 */
export async function getSeafarerLogin(user: SessionUser, seafarerId: string) {
  const row = await prisma.seafarer.findFirst({
    where: { id: seafarerId, companyId: user.companyId, deletedAt: null },
    select: { user: { select: { id: true, email: true } } },
  });
  return row?.user ?? null;
}

/**
 * Company logins not yet tied to any seafarer — the "link existing" picker on
 * the seafarer record. Active, live accounts whose one-to-one `seafarer`
 * back-relation is empty. No passwordHash or any masterlist field is selected.
 */
export async function listUnlinkedUserOptions(companyId: string) {
  return prisma.user.findMany({
    where: { companyId, deletedAt: null, active: true, seafarer: null },
    select: { id: true, email: true, fullName: true },
    orderBy: [{ fullName: "asc" }],
  });
}
