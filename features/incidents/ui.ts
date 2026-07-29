// Shared UI helpers for incident badges.
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

export function incidentStatusTone(status: string): Tone {
  switch (status) {
    case "CLOSED":
      return "success";
    case "UNDER_INVESTIGATION":
    case "ACTION_PENDING":
      return "warning";
    case "REPORTED":
    default:
      return "accent";
  }
}
