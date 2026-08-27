import "server-only";
import type { DepartmentType } from "@/lib/generated/prisma";

/**
 * The single bridge between the legacy `User.department` enum and the new
 * data-driven Department table.
 *
 * TODAY this returns exactly `user.department === "SHIPBOARD"` — byte-for-byte
 * the check that 73 files across the app already make (most importantly
 * lib/vessel-scope.ts, the vessel boundary for 12 modules). Nothing about the
 * shipboard/shore decision changes in this batch: the enum stays the security
 * signal, and this helper is only a NAMED front door to it so a future switch
 * has one place to happen instead of 73.
 *
 * TOMORROW, once every user row has a `departmentRefId` and each Department
 * carries its `side`, this becomes `user.department?.side === "SHIP"` (or an
 * equivalent read of the joined Department row). That switch is a SEPARATE,
 * deliberately verified change — it must not ship until the backfill that maps
 * every legacy enum value onto a Department row is complete and checked, or
 * ships would leak each other's data. Do NOT rewire the existing call sites
 * onto this helper as part of adding it; introducing the tables and flipping
 * the boundary are two different, independently reviewable steps.
 */
export function isShipboard(user: { department: DepartmentType }): boolean {
  return user.department === "SHIPBOARD";
}
