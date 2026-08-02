// Shared UI helper for Risk Assessment status badges — mirrors
// features/incidents/ui.ts. This is about the *lifecycle* status
// (RiskAssessmentStatus), not the risk *level* badge (riskTone in the page
// files, e.g. LOW/MEDIUM/HIGH/CRITICAL) — that's a separate concept and is
// left untouched.
import { LIFECYCLE_TONE } from "@/lib/status";

type Tone = "neutral" | "accent" | "success" | "danger" | "warning";

/**
 * ACTIVE = this is the current, in-force assessment — the OPEN-equivalent
 * (active, "green" state) for this module. CLOSED and SUPERSEDED are both
 * terminal/no-longer-operative states, so both map to the same CLOSED gray —
 * `RiskAssessmentStatus` has no distinct "awaiting verification" step today.
 */
export function riskAssessmentStatusTone(status: string): Tone {
  if (status === "CLOSED" || status === "SUPERSEDED") return LIFECYCLE_TONE.CLOSED;
  return LIFECYCLE_TONE.OPEN; // ACTIVE
}
