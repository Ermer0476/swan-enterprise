import type { BadgeTone } from "@/lib/utils";

/**
 * Assignment status — DERIVED on every read, never stored. See
 * prisma/schema.prisma's own comment on `CrewAssignment` ("NO STATUS COLUMN,
 * AND DO NOT ADD ONE") and docs/plans/crewing.md §6.2: a stored status is
 * wrong the morning after it is written, and silently.
 *
 * The whole state machine is two nullable columns:
 *
 *   actualSignOnDate  null → he has not joined yet          → PLANNED
 *   actualSignOffDate null → he joined and has not left     → ABOARD
 *   both set          → the tour is over                    → COMPLETED
 *
 * Pure, and `now` is a parameter rather than a clock read, for the same two
 * reasons features/vessel-documents/expiry.ts states: it can be called with a
 * fixed date, and a client component computing its own `new Date()` would
 * disagree with the server render it hydrates.
 */

export type AssignmentStatus = "PLANNED" | "ABOARD" | "COMPLETED";

/**
 * A signed-off date with no signed-on date is not a state this module can
 * produce — signOffAction refuses unless the assignment is ABOARD — but it is
 * a state the database can hold, so it is answered rather than ignored:
 * COMPLETED, because the man is demonstrably not aboard. Reporting PLANNED for
 * a row carrying a sign-off date would put him on a crew list.
 */
export function assignmentStatus(a: {
  actualSignOnDate: Date | null;
  actualSignOffDate: Date | null;
}): AssignmentStatus {
  if (a.actualSignOffDate) return "COMPLETED";
  if (a.actualSignOnDate) return "ABOARD";
  return "PLANNED";
}

/** Midnight UTC on `now`'s calendar date. Sign-on/sign-off dates come from
 *  `<input type="date">` and are stored at UTC midnight, so every day count in
 *  this module is taken against the same boundary — see expiry.ts's rule 1. */
export function startOfTodayUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Days aboard: sign-on to sign-off, or to today while he is still aboard.
 *
 * Returns null when he has not joined — "not applicable", which the UI renders
 * as a dash. A 0 would read as "joined today", which is a different fact.
 *
 * The day he joins counts as day 0, not day 1: a Master reading "0 days" the
 * morning a man walks up the gangway is right, and it matches how the two
 * dates subtract.
 */
export function daysAboard(
  a: { actualSignOnDate: Date | null; actualSignOffDate: Date | null },
  now: Date,
): number | null {
  if (!a.actualSignOnDate) return null;
  const end = a.actualSignOffDate ?? startOfTodayUtc(now);
  const days = Math.floor((end.getTime() - a.actualSignOnDate.getTime()) / MS_PER_DAY);
  // A sign-on date in the future (the desk recorded a join it expects
  // tomorrow) would otherwise read as a negative count.
  return days < 0 ? 0 : days;
}

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  PLANNED: "Planned",
  ABOARD: "Aboard",
  COMPLETED: "Completed",
};

export function assignmentStatusTone(status: AssignmentStatus): BadgeTone {
  switch (status) {
    case "ABOARD":
      return "success";
    case "PLANNED":
      return "accent";
    case "COMPLETED":
      return "neutral";
  }
}
