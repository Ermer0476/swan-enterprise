import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind class names, resolving conflicts (shadcn convention). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Format a date for compact display, e.g. "27 Jul 2026". */
export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  // Fixed timeZone so the server (UTC) and the browser (e.g. Asia/Manila, UTC+8)
  // always render the SAME calendar day. Without it, a time-bearing date near
  // midnight formats as a different day on each side → a React hydration
  // mismatch on every dated row, which makes the list re-render and clicks feel
  // dropped (needing a second click).
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Turn an ENUM_VALUE into a "Enum Value" label. */
export function humanize(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export type BadgeTone = "neutral" | "accent" | "success" | "danger" | "warning";

/** Consistent badge tone for the shared Severity scale. */
export function severityTone(severity: string): BadgeTone {
  switch (severity) {
    case "CRITICAL":
      return "danger";
    case "HIGH":
    case "MAJOR":
      return "warning";
    case "MEDIUM":
      return "accent";
    case "LOW":
    case "MINOR":
    default:
      return "neutral";
  }
}
