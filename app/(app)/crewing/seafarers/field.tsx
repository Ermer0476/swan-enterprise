import * as React from "react";
import { Label } from "@/components/ui/input";

/**
 * A labelled form field — Capt's `space-y-1.5` + `<Label>` pattern with an
 * optional required marker, hint and per-field error, wrapped once so the
 * crewing forms (~50 fields across the seafarer form and the crew-change panel)
 * stay readable. Local to crewing on purpose: it is not a new app-wide
 * primitive, just Capt's existing markup gathered behind one name. The control
 * itself is passed as children so it keeps its own `name`/`type`/`defaultValue`.
 */
export function Field({
  id,
  label,
  required,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
