// Shared UI helpers for incident badges.
import { LIFECYCLE_TONE } from "@/lib/status";

type Tone = "neutral" | "accent" | "success" | "danger" | "warning";

export function severityTone(severity: string): Tone {
  switch (severity) {
    case "CRITICAL":
      return "danger";
    case "HIGH":
      return "warning";
    case "MEDIUM":
      return "accent";
    case "LOW":
    default:
      return "neutral";
  }
}

/**
 * REPORTED (just filed, nobody's picked it up yet) reads as OPEN; once it's
 * under active investigation or the corrective action is being worked,
 * that's functionally "awaiting the next step" the same way the app-wide
 * UNDER_REVIEW bucket is elsewhere — kept as its own distinct color so the
 * list still visually distinguishes "brand new" from "already being worked."
 */
export function incidentStatusTone(status: string): Tone {
  if (status === "CLOSED") return LIFECYCLE_TONE.CLOSED;
  if (status === "UNDER_INVESTIGATION" || status === "ACTION_PENDING") return LIFECYCLE_TONE.UNDER_REVIEW;
  return LIFECYCLE_TONE.OPEN; // REPORTED
}
