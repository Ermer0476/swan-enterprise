// Shared UI helper for NCR status badges — mirrors features/incidents/ui.ts.
import { LIFECYCLE_TONE } from "@/lib/status";

type Tone = "neutral" | "accent" | "success" | "danger" | "warning";

/**
 * DRAFT = not yet raised.
 * SUBMITTED_TO_OFFICE = raised and with the office; RCA/corrective action
 * may still be in progress, awaiting DPA/General Manager verification — this
 * is the app-wide UNDER_REVIEW case.
 * VERIFIED = verification signed off; awaiting Close Out — still an
 * office-in-progress state, so it shares SUBMITTED_TO_OFFICE's tone.
 * CLOSED = closed out.
 */
export function ncrStatusTone(status: string): Tone {
  if (status === "CLOSED") return LIFECYCLE_TONE.CLOSED;
  if (status === "SUBMITTED_TO_OFFICE" || status === "VERIFIED") return LIFECYCLE_TONE.UNDER_REVIEW;
  return LIFECYCLE_TONE.OPEN;
}
