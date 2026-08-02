// Shared UI helper for Defect status badges — mirrors features/incidents/ui.ts.
import { LIFECYCLE_TONE } from "@/lib/status";

type Tone = "neutral" | "accent" | "success" | "danger" | "warning";

/**
 * OPEN = still active, nothing done yet. MONITORING = being watched/worked —
 * treated as the app-wide UNDER_REVIEW color (matches this module's prior
 * "in-progress" tone, just recolored to the new standard). RECTIFIED is this
 * module's equivalent of CLOSED (`DefectStatus` has no literal "CLOSED"
 * value). DEFERRED (postponed, not currently being worked) maps to the same
 * gray as CLOSED — it's the one judgment call in this mapping, since a
 * deferred defect is neither "open work" nor "closed," but the standard
 * gives only three colors to choose from.
 */
export function defectStatusTone(status: string): Tone {
  if (status === "RECTIFIED" || status === "DEFERRED") return LIFECYCLE_TONE.CLOSED;
  if (status === "MONITORING") return LIFECYCLE_TONE.UNDER_REVIEW;
  return LIFECYCLE_TONE.OPEN; // OPEN
}
