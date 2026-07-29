"use client";

import { useState } from "react";
import { Label } from "@/components/ui/input";
import {
  HUMAN_FACTORS,
  HUMAN_FACTOR_LABELS,
  MAX_CONTRIBUTING_FACTORS,
} from "@/lib/root-cause";

/**
 * Human-factors picker used by both the incident report form and the
 * investigation form. Enforces exactly one primary factor (required) and up to
 * MAX_CONTRIBUTING_FACTORS contributing factors — the system blocks the extra
 * selection and prevents the primary factor being chosen again as contributing.
 * Inputs submit natively under `humanFactorPrimary` / `humanFactorContributing`.
 */
export function HumanFactorsPicker({
  initialPrimary = "",
  initialContributing = [],
}: {
  initialPrimary?: string;
  initialContributing?: string[];
}) {
  const [primary, setPrimary] = useState(initialPrimary);
  const [contributing, setContributing] = useState<string[]>(initialContributing);
  const full = contributing.length >= MAX_CONTRIBUTING_FACTORS;

  function toggleContributing(factor: string, checked: boolean) {
    setContributing((prev) => {
      if (checked) {
        if (prev.length >= MAX_CONTRIBUTING_FACTORS) return prev; // block extra
        return [...prev, factor];
      }
      return prev.filter((f) => f !== factor);
    });
  }

  return (
    <div className="space-y-4 rounded-md border border-accent/30 bg-accent/5 p-4">
      <div className="space-y-2">
        <Label>
          Primary human factor{" "}
          <span className="text-muted-foreground">(choose one, required)</span>
        </Label>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {HUMAN_FACTORS.map((f) => (
            <label
              key={f}
              className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <input
                type="radio"
                name="humanFactorPrimary"
                value={f}
                checked={primary === f}
                onChange={() => {
                  setPrimary(f);
                  setContributing((prev) => prev.filter((c) => c !== f));
                }}
                className="h-4 w-4"
              />
              {HUMAN_FACTOR_LABELS[f]}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>
          Contributing factors{" "}
          <span className="text-muted-foreground">
            (choose up to {MAX_CONTRIBUTING_FACTORS})
          </span>
        </Label>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {HUMAN_FACTORS.map((f) => {
            const isPrimary = primary === f;
            const checked = contributing.includes(f);
            const disabled = isPrimary || (!checked && full);
            return (
              <label
                key={f}
                className={
                  "flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm " +
                  (disabled ? "opacity-40" : "")
                }
              >
                <input
                  type="checkbox"
                  name="humanFactorContributing"
                  value={f}
                  checked={checked}
                  disabled={disabled}
                  onChange={(e) => toggleContributing(f, e.target.checked)}
                  className="h-4 w-4"
                />
                {HUMAN_FACTOR_LABELS[f]}
              </label>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          {contributing.length}/{MAX_CONTRIBUTING_FACTORS} selected
          {full ? " — limit reached" : ""}
        </p>
      </div>
    </div>
  );
}
