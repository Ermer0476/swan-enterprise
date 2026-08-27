"use client";

import { X } from "lucide-react";
import {
  RA_LEVELS,
  computeRF,
  riskBand,
  type RiskScaleLabels,
} from "@/features/risk/schema";
import type { ParsedHazardRowDraft } from "@/features/risk/document-parser";
import { bandTone } from "@/features/risk/ui";
import { Badge } from "@/components/ui/badge";
import { AutoGrowInput, Input, Label, Select } from "@/components/ui/input";
import { humanize } from "@/lib/utils";

/** One review row for a parsed hazard-row draft — every field stays
 * editable so the office can fix anything the reader got wrong before it's
 * actually saved; used by both the New Risk Assessment upload flow and the
 * revision-page import panel. */
export function DraftCard({
  draft,
  index,
  scaleLabels,
  onChange,
  onRemove,
}: {
  draft: ParsedHazardRowDraft;
  index: number;
  scaleLabels: RiskScaleLabels;
  onChange: (index: number, next: ParsedHazardRowDraft) => void;
  onRemove: (index: number) => void;
}) {
  function setField<K extends keyof ParsedHazardRowDraft>(field: K, value: ParsedHazardRowDraft[K]) {
    onChange(index, { ...draft, [field]: value });
  }

  const rf = computeRF(draft.severity, draft.likelihood);
  const band = riskBand(rf);
  const resL = draft.resLikelihood ?? draft.likelihood;
  const resRf = computeRF(draft.severity, resL);
  const resBand = riskBand(resRf);

  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground">
          Row {draft.sourceRowLabel || index + 1}
        </span>
        <button
          type="button"
          onClick={() => onRemove(index)}
          aria-label="Remove this draft"
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-danger"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Phase</Label>
        <Input value={draft.phase ?? ""} onChange={(e) => setField("phase", e.target.value || null)} placeholder="e.g. PHASE 1 — PRE-WORK PREPARATION" />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Unwanted Consequence</Label>
        <AutoGrowInput className="max-h-none" value={draft.consequence} onChange={(e) => setField("consequence", e.target.value)} required />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Possible Causes / Hazard Factors</Label>
        <AutoGrowInput className="max-h-none" value={draft.causes} onChange={(e) => setField("causes", e.target.value)} required />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Severity</Label>
          <Select value={draft.severity} onChange={(e) => setField("severity", Number(e.target.value))}>
            {RA_LEVELS.map((l) => <option key={l} value={l}>{scaleLabels.severity[l]}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Likelihood</Label>
          <Select value={draft.likelihood} onChange={(e) => setField("likelihood", Number(e.target.value))}>
            {RA_LEVELS.map((l) => <option key={l} value={l}>{scaleLabels.likelihood[l]}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Initial RF</Label>
          <div className="flex h-9 items-center gap-2">
            <span className="text-sm font-medium tabular-nums">{rf}</span>
            <Badge tone={bandTone(band)}>{humanize(band)}</Badge>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Existing Controls</Label>
        <AutoGrowInput className="max-h-none" value={draft.existingControls} onChange={(e) => setField("existingControls", e.target.value)} required />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Additional Controls (this operation)</Label>
        <AutoGrowInput className="max-h-none" value={draft.additionalControls ?? ""} onChange={(e) => setField("additionalControls", e.target.value || null)} />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5 col-span-2 sm:col-span-1">
          <Label className="text-xs">Residual Likelihood</Label>
          <Select value={resL} onChange={(e) => setField("resLikelihood", Number(e.target.value))}>
            {RA_LEVELS.map((l) => <option key={l} value={l}>{scaleLabels.likelihood[l]}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Residual RF</Label>
          <div className="flex h-9 items-center gap-2">
            <span className="text-sm font-medium tabular-nums">{resRf}</span>
            <Badge tone={bandTone(resBand)}>{humanize(resBand)}</Badge>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Responsible</Label>
        <Input value={draft.responsible ?? ""} onChange={(e) => setField("responsible", e.target.value || null)} placeholder="e.g. Chief Officer / Bosun" />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={draft.isNew}
          onChange={(e) => setField("isNew", e.target.checked)}
          className="h-4 w-4 rounded border-input"
        />
        ★ New hazard added in this revision
      </label>
    </div>
  );
}
