/**
 * SWAN Enterprise's app-wide lifecycle status color standard:
 *   - OPEN         🔴 red    — active work (root cause/corrective action/
 *                  attachments/remarks may still change) — needs attention
 *   - UNDER_REVIEW 🟡 amber  — the working side is done; awaiting DPA /
 *                  General Manager / office verification before it can close
 *   - CLOSED       🟢 green  — verified and closed — read-only from here on
 *
 * This is a display-only concern: no module's actual Prisma status enum is
 * renamed to match these three names. Every module keeps its own real status
 * values (NcrStatus, IncidentStatus, InspectionStatus, DefectStatus, …) —
 * each module's own tone function (this one for the shared OPEN/IN_PROGRESS/
 * CLOSED shape, or a bespoke one in modules with a different-shaped enum,
 * e.g. `features/incidents/ui.ts`, `features/near-miss/schema.ts`) maps its
 * own values onto these three colors, so the same visual meaning holds
 * everywhere a status badge is shown across the whole ERP.
 *
 * `LIFECYCLE_TONE` is the single source of truth for the three colors
 * themselves — every module's own bucketing function should return one of
 * these three constants rather than hardcoding "success"/"warning"/"danger"
 * directly, so a future re-standardization is a one-line change here instead
 * of a repo-wide find-and-replace.
 */
export const LIFECYCLE_TONE = {
  OPEN: "danger",
  UNDER_REVIEW: "warning",
  CLOSED: "success",
} as const;

/**
 * Shared status → badge-tone mapping for the modules whose lifecycle uses
 * the exact same OPEN/IN_PROGRESS/CLOSED (or OPEN/CLOSED) shape: SIRE / PSC /
 * CDI inspections (`InspectionStatus`), Internal/External Audit findings
 * (`FindingStatus`), and Emergency Drills (which also reuses `FindingStatus`).
 *
 * Originally replaced 13 byte-identical duplicate `statusTone()` functions
 * (SIRE / PSC / CDI / Internal Audits / External Audits — list, detail, and
 * report page for each). See BUSINESS_CONSISTENCY.md §6.
 */
const UNDER_REVIEW_VALUES = new Set(["IN_PROGRESS", "UNDER_REVIEW"]);

export function lifecycleStatusTone(status: string): (typeof LIFECYCLE_TONE)[keyof typeof LIFECYCLE_TONE] {
  if (status === "CLOSED") return LIFECYCLE_TONE.CLOSED;
  if (UNDER_REVIEW_VALUES.has(status)) return LIFECYCLE_TONE.UNDER_REVIEW;
  return LIFECYCLE_TONE.OPEN; // OPEN, and anything else not yet under review or closed
}
