import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "accent" | "success" | "danger" | "warning";

const tones: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  accent: "bg-accent/10 text-accent",
  success: "bg-success/10 text-success",
  danger: "bg-danger/10 text-danger",
  warning: "bg-warning/10 text-warning",
};

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

/** Map a DocumentStatus to a badge tone for consistent status coloring. */
export function statusTone(status: string): Tone {
  switch (status) {
    case "APPROVED":
      return "success";
    case "IN_REVIEW":
      return "warning";
    case "ARCHIVED":
      return "neutral";
    case "DRAFT":
    default:
      return "accent";
  }
}
