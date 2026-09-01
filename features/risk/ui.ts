// Shared UI helpers for the Risk Assessment controlled-document module.
import { LIFECYCLE_TONE } from "@/lib/status";
import type { RiskBand } from "./schema";

type Tone = "neutral" | "accent" | "success" | "danger" | "warning";

/** DocumentStatus (DRAFT/IN_REVIEW/APPROVED/ARCHIVED) tone — mirrors sms-manual/ui.ts. */
export function riskDocStatusTone(status: string): Tone {
  if (status === "APPROVED") return "success";
  if (status === "IN_REVIEW") return "warning";
  if (status === "ARCHIVED") return LIFECYCLE_TONE.CLOSED;
  return "neutral"; // DRAFT
}

/** RC-012's RF matrix band → badge tone (Green/Yellow/Red). */
export function bandTone(band: RiskBand): Tone {
  if (band === "RED") return "danger";
  if (band === "YELLOW") return "warning";
  return "success"; // GREEN
}

export function reviewStatusTone(nextReviewDate: Date | null): { label: string; tone: Tone } {
  if (!nextReviewDate) return { label: "Not scheduled", tone: "neutral" };
  const now = new Date();
  const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  if (nextReviewDate < now) return { label: "Overdue", tone: "danger" };
  if (nextReviewDate <= soon) return { label: "Due Soon", tone: "warning" };
  return { label: "Current", tone: "success" };
}

/** RaFeedbackDisposition → badge tone, for the Vessel Feedback screen. */
export function dispositionTone(disposition: string | null): Tone {
  if (disposition === "ADDED_TO_TEMPLATE") return "success";
  if (disposition === "ALREADY_COVERED") return "neutral";
  if (disposition === "FURTHER_REVIEW_REQUIRED") return "warning";
  if (disposition === "NOT_ADDED") return LIFECYCLE_TONE.CLOSED;
  return "neutral"; // no decision yet
}
