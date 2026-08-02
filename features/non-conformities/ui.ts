// Shared UI helper for NCR status badges — mirrors features/incidents/ui.ts.
import { LIFECYCLE_TONE } from "@/lib/status";

type Tone = "neutral" | "accent" | "success" | "danger" | "warning";

/**
 * OPEN = still being worked (RCA/corrective action in progress).
 * SUBMITTED_TO_OFFICE = the vessel/responsible person is done; awaiting
 * DPA/General Manager verification — this is the app-wide UNDER_REVIEW case.
 * CLOSED = verified and closed.
 */
export function ncrStatusTone(status: string): Tone {
  if (status === "CLOSED") return LIFECYCLE_TONE.CLOSED;
  if (status === "SUBMITTED_TO_OFFICE") return LIFECYCLE_TONE.UNDER_REVIEW;
  return LIFECYCLE_TONE.OPEN;
}
