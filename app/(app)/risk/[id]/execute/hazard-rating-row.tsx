"use client";

import {
  RA_LEVELS,
  SEVERITY_SCALE_LABELS,
  LIKELIHOOD_SCALE_LABELS,
  computeRF,
  riskBand,
} from "@/features/risk/schema";
import { bandTone } from "@/features/risk/ui";
import { Badge } from "@/components/ui/badge";
import { Label, Select } from "@/components/ui/input";
import { humanize } from "@/lib/utils";

export type HazardRowOption = {
  id: string;
  phase: string | null;
  consequence: string;
  existingControls: string;
  additionalControls: string | null;
  severity: number;
  likelihood: number;
  resLikelihood: number | null;
  isVesselAddendum: boolean;
};

export type HazardRating = { severity: number; likelihood: number; resLikelihood: number };

/** Template's own Severity/Likelihood/Residual Likelihood as the starting
 * point for the vessel's own re-rating — editable, never locked. */
export function defaultRating(hazard: HazardRowOption): HazardRating {
  return {
    severity: hazard.severity,
    likelihood: hazard.likelihood,
    resLikelihood: hazard.resLikelihood ?? hazard.likelihood,
  };
}

/** One selectable hazard on the Job Execution form. Unchecked: a one-line
 * summary. Checked: expands inline into the vessel's actual Severity/
 * Likelihood re-rating for this job, a read-only reminder of the template's
 * controls, and a residual re-rating — same live RF-badge pattern already
 * used when the office authors a hazard row (hazard-row-form.tsx), just
 * scoped to this one job's conditions rather than the master template. */
export function HazardRatingRow({
  hazard,
  checked,
  onToggle,
  rating,
  onRatingChange,
}: {
  hazard: HazardRowOption;
  checked: boolean;
  onToggle: () => void;
  rating: HazardRating;
  onRatingChange: (next: HazardRating) => void;
}) {
  const rf = computeRF(rating.severity, rating.likelihood);
  const band = riskBand(rf);
  const resRf = computeRF(rating.severity, rating.resLikelihood);
  const resBand = riskBand(resRf);

  return (
    <div className="rounded px-1.5 py-1 hover:bg-muted/40">
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-input"
          checked={checked}
          onChange={onToggle}
        />
        <span>
          {hazard.consequence}
          {hazard.phase && <span className="text-muted-foreground"> — {hazard.phase}</span>}
          {hazard.isVesselAddendum && (
            <span className="ml-1.5 rounded bg-warning/10 px-1.5 py-0.5 text-xs text-warning">
              vessel addendum
            </span>
          )}
        </span>
      </label>

      {checked && (
        <div className="ml-6 mt-2 space-y-3 rounded-md border border-border bg-muted/20 p-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Severity (actual)</Label>
              <Select
                value={rating.severity}
                onChange={(e) => onRatingChange({ ...rating, severity: Number(e.target.value) })}
              >
                {RA_LEVELS.map((l) => (
                  <option key={l} value={l}>{SEVERITY_SCALE_LABELS[l]}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Likelihood (actual)</Label>
              <Select
                value={rating.likelihood}
                onChange={(e) => onRatingChange({ ...rating, likelihood: Number(e.target.value) })}
              >
                {RA_LEVELS.map((l) => (
                  <option key={l} value={l}>{LIKELIHOOD_SCALE_LABELS[l]}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Initial RF</Label>
              <div className="flex h-9 items-center gap-2">
                <span className="text-sm font-medium tabular-nums">{rf}</span>
                <Badge tone={bandTone(band)}>{humanize(band)}</Badge>
              </div>
            </div>
          </div>

          <div className="space-y-1 text-xs text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Existing controls: </span>
              {hazard.existingControls}
            </p>
            {hazard.additionalControls && (
              <p>
                <span className="font-medium text-foreground">Additional controls: </span>
                {hazard.additionalControls}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="col-span-2 space-y-1 sm:col-span-1">
              <Label className="text-xs">Residual Likelihood</Label>
              <Select
                value={rating.resLikelihood}
                onChange={(e) => onRatingChange({ ...rating, resLikelihood: Number(e.target.value) })}
              >
                {RA_LEVELS.map((l) => (
                  <option key={l} value={l}>{LIKELIHOOD_SCALE_LABELS[l]}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Residual RF</Label>
              <div className="flex h-9 items-center gap-2">
                <span className="text-sm font-medium tabular-nums">{resRf}</span>
                <Badge tone={bandTone(resBand)}>{humanize(resBand)}</Badge>
              </div>
            </div>
            <p className="col-span-2 self-center text-xs text-muted-foreground sm:col-span-1">
              Severity fixed at {rating.severity} for the residual rating (SSP-13 Sec. 5.7).
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
