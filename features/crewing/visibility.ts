import "server-only";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";
import type { Prisma } from "@/lib/generated/prisma";

/**
 * The crewing boundary. Stated here rather than reusing a shared vessel-scope
 * fragment, for one specific reason.
 *
 * A general vessel scope carries a `createdBy` disjunct — "anything this login
 * itself filed" — which is correct for incidents and defects but WRONG HERE,
 * and not marginally:
 *
 *   This fleet's men rotate between ships. A Master who records a sign-on and
 *   later a sign-off keeps `createdBy = his login` on that row forever. With
 *   the disjunct, one vessel's Master retains a permanent window onto a
 *   seafarer's movements after the man has joined another ship. For an
 *   operational record that is a shrug. For personal data it is an
 *   access-control defect, and one that grows with every crew change.
 *
 * The disjunct is also unnecessary: CrewAssignment.vesselId is REQUIRED, so
 * there is no assignment with no ship, so there is nothing for `createdBy` to
 * rescue.
 */
export function crewAssignmentScopeFor(user: SessionUser): Prisma.CrewAssignmentWhereInput {
  if (user.department !== "SHIPBOARD") return {};
  // A SHIPBOARD account with no vessel must match NOTHING. `{ vesselId: null }`
  // cannot express that — the column is required — and `{}` would return the
  // whole fleet. `{ id: { in: [] } }` is the match-nothing shape.
  if (!user.vesselId) return { id: { in: [] } };
  return { vesselId: user.vesselId };
}

/** Is this caller the office? Read from the session (which the server built),
 *  never from a form. */
function isOfficeCaller(user: SessionUser): boolean {
  return user.department !== "SHIPBOARD";
}

/**
 * The office-only rule for PAGES: answered with the ordinary 404, exactly as a
 * missing permission is, and for the identical reason — *doesn't exist*,
 * *isn't yours* and *you may not see it* must be indistinguishable, or the
 * refusal is an existence oracle. A Ship Officer opening /crewing/seafarers
 * gets a 404, not a 403.
 *
 * Server ACTIONS do not use this — a throw/redirect in a server component is a
 * render failure. Actions perform the department gate inline
 * (`if (user.department === "SHIPBOARD") return fail(...)`) after their
 * permission check.
 */
export function requireOfficeOrNotFound(user: SessionUser): void {
  if (!isOfficeCaller(user)) notFound();
}

/**
 * Loads one assignment inside the caller's boundary: company, `deletedAt:
 * null`, and the boundary in `AND`. Returns null for *doesn't exist*, *isn't
 * yours* and *can't see it* alike, so the refusal is not an existence oracle.
 *
 * NOTE the select. This loader is reached by the WRITE path, where the caller
 * needs the row's own columns — but it names them, and names NO seafarer field
 * at all: an action that needs the man's name reads it through queries.ts,
 * which applies the field tier.
 */
export async function findCrewAssignmentForActor(user: SessionUser, id: string) {
  return prisma.crewAssignment.findFirst({
    where: {
      id,
      companyId: user.companyId,
      deletedAt: null,
      AND: [crewAssignmentScopeFor(user)],
    },
    select: {
      id: true,
      seafarerId: true,
      vesselId: true,
      rankCode: true,
      plannedSignOnDate: true,
      actualSignOnDate: true,
      plannedSignOffDate: true,
      actualSignOffDate: true,
      signOnPort: true,
      signOffPort: true,
      signOffReason: true,
      reliefForAssignmentId: true,
      vesselRemarks: true,
      shoreRemarks: true,
      updatedAt: true,
    },
  });
}

/**
 * Every column of `Seafarer`, named one at a time.
 *
 * ── THIS IS THE WRITE PATH'S SELECT AND IT IS NOT A READ TIER ──
 * `updateSeafarerAction` needs the before-values of the sensitive columns in
 * memory: that is the only way to know whether a date of birth CHANGED, which
 * `diffFields(..., { exclude: CREW_AUDIT_EXCLUDE })` reports without recording
 * either value. So this payload legitimately contains everything.
 *
 * It must therefore never be handed to a component, returned from a page, or
 * re-exported. Pages and lists read through queries.ts, whose two tiers decide
 * what leaves the server.
 */
const SEAFARER_WRITE_SELECT = {
  id: true,
  crewCode: true,
  lastName: true,
  firstName: true,
  middleName: true,
  suffix: true,
  nationality: true,
  dateOfBirth: true,
  contactPhone: true,
  contactEmail: true,
  nextOfKinName: true,
  nextOfKinRelationship: true,
  nextOfKinPhone: true,
  active: true,
  redactedAt: true,
  updatedAt: true,
} as const;

/**
 * Loads one seafarer for an office write. There is no vessel boundary to apply
 * — `Seafarer` has no `vesselId` and never will (§5.1) — so the boundary here
 * is the department itself, which is why the caller must have passed the inline
 * office gate first. Company-scoped and soft-delete-filtered; null means not
 * found, not yours, or already deleted.
 */
export async function findSeafarerForOffice(user: SessionUser, id: string) {
  return prisma.seafarer.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
    select: SEAFARER_WRITE_SELECT,
  });
}
