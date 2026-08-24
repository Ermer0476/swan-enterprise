"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import {
  updateHazardRowAction,
  deleteHazardRowAction,
  type ActionResult,
} from "@/features/risk/actions";
import { RA_LEVELS, computeRF, riskBand } from "@/features/risk/schema";
import { bandTone } from "@/features/risk/ui";
import { Badge } from "@/components/ui/badge";
import { AutoGrowInput, Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Row = {
  id: string;
  rowNo: number;
  phase: string | null;
  consequence: string;
  causes: string;
  severity: number;
  likelihood: number;
  existingControls: string;
  additionalControls: string | null;
  resLikelihood: number | null;
  responsible: string | null;
  isNew: boolean;
  ratingChangeNote: string | null;
  vesselId: string | null;
  vesselName: string | null;
};

export function HazardRowItem({
  row,
  documentId,
  editable,
  showActionsColumn = editable,
}: {
  row: Row;
  documentId: string;
  /** Can THIS row's edit/delete buttons be used by the current viewer. */
  editable: boolean;
  /** Does the table this row lives in have an actions column at all — a
   * table can mix office-editable master rows with a vessel's own editable
   * addendum rows, so some rows are editable and others aren't; every row
   * still needs to render the column (even empty) to keep them aligned. */
  showActionsColumn?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [phase, setPhase] = useState(row.phase ?? "");
  const [consequence, setConsequence] = useState(row.consequence);
  const [causes, setCauses] = useState(row.causes);
  const [severity, setSeverity] = useState(row.severity);
  const [likelihood, setLikelihood] = useState(row.likelihood);
  const [existingControls, setExistingControls] = useState(row.existingControls);
  const [additionalControls, setAdditionalControls] = useState(row.additionalControls ?? "");
  const [resLikelihood, setResLikelihood] = useState(row.resLikelihood ?? row.likelihood);
  const [responsible, setResponsible] = useState(row.responsible ?? "");

  function save() {
    setError(null);
    const fd = new FormData();
    fd.set("rowId", row.id);
    fd.set("phase", phase);
    fd.set("consequence", consequence);
    fd.set("causes", causes);
    fd.set("severity", String(severity));
    fd.set("likelihood", String(likelihood));
    fd.set("existingControls", existingControls);
    fd.set("additionalControls", additionalControls);
    fd.set("resLikelihood", String(resLikelihood));
    fd.set("responsible", responsible);
    startTransition(async () => {
      const res: ActionResult = await updateHazardRowAction(fd);
      if (!res.ok) setError(res.error);
      else setIsEditing(false);
    });
  }

  function cancel() {
    setPhase(row.phase ?? "");
    setConsequence(row.consequence);
    setCauses(row.causes);
    setSeverity(row.severity);
    setLikelihood(row.likelihood);
    setExistingControls(row.existingControls);
    setAdditionalControls(row.additionalControls ?? "");
    setResLikelihood(row.resLikelihood ?? row.likelihood);
    setResponsible(row.responsible ?? "");
    setError(null);
    setIsEditing(false);
  }

  function remove() {
    if (!confirm("Remove this hazard row?")) return;
    setError(null);
    const fd = new FormData();
    fd.set("rowId", row.id);
    fd.set("documentId", documentId);
    startTransition(async () => {
      const res: ActionResult = await deleteHazardRowAction(fd);
      if (!res.ok) setError(res.error);
    });
  }

  if (isEditing) {
    const rf = computeRF(severity, likelihood);
    const band = riskBand(rf);
    const resRf = computeRF(severity, resLikelihood);
    const resBand = riskBand(resRf);
    return (
      <tr className="border-b border-border bg-muted/20 align-top last:border-0">
        <td className="px-3 py-2 tabular-nums text-muted-foreground">
          {row.rowNo}
          <Input
            value={phase}
            onChange={(e) => setPhase(e.target.value)}
            placeholder="Phase"
            className="mt-1 h-7 w-32 text-xs"
          />
        </td>
        <td className="px-3 py-2 min-w-[10rem]">
          <AutoGrowInput value={consequence} onChange={(e) => setConsequence(e.target.value)} className="max-h-none" />
        </td>
        <td className="px-3 py-2 min-w-[12rem]">
          <AutoGrowInput value={causes} onChange={(e) => setCauses(e.target.value)} className="max-h-none" />
        </td>
        <td className="px-3 py-2">
          <Select value={severity} onChange={(e) => setSeverity(Number(e.target.value))} className="w-16">
            {RA_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </Select>
        </td>
        <td className="px-3 py-2">
          <Select value={likelihood} onChange={(e) => setLikelihood(Number(e.target.value))} className="w-16">
            {RA_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </Select>
        </td>
        <td className="px-3 py-2">
          <Badge tone={bandTone(band)}>{rf}</Badge>
        </td>
        <td className="px-3 py-2 min-w-[12rem]">
          <AutoGrowInput value={existingControls} onChange={(e) => setExistingControls(e.target.value)} className="max-h-none" />
        </td>
        <td className="px-3 py-2 min-w-[12rem]">
          <AutoGrowInput value={additionalControls} onChange={(e) => setAdditionalControls(e.target.value)} className="max-h-none" />
        </td>
        <td className="px-3 py-2">
          <Select value={resLikelihood} onChange={(e) => setResLikelihood(Number(e.target.value))} className="w-16">
            {RA_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </Select>
        </td>
        <td className="px-3 py-2">
          <Badge tone={bandTone(resBand)}>{resRf}</Badge>
        </td>
        <td className="px-3 py-2">
          <Input value={responsible} onChange={(e) => setResponsible(e.target.value)} className="w-32" />
        </td>
        <td className="px-3 py-2">
          <div className="flex flex-col items-end gap-1">
            <div className="flex gap-1">
              <Button size="sm" variant="success" onClick={save} disabled={pending}>
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" onClick={cancel} disabled={pending}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            {error && <p className="text-xs text-danger">{error}</p>}
          </div>
        </td>
      </tr>
    );
  }

  const rf = computeRF(row.severity, row.likelihood);
  const rBand = riskBand(rf);
  const resL = row.resLikelihood ?? row.likelihood;
  const resRf = computeRF(row.severity, resL);
  const resBand = riskBand(resRf);

  return (
    <tr className={`border-b border-border align-top last:border-0 ${row.vesselId ? "bg-accent/[0.03]" : ""}`}>
      <td className="px-3 py-2 tabular-nums text-muted-foreground">
        {row.rowNo}
        {row.vesselId ? (
          <Badge tone="accent" className="ml-1">{row.vesselName ?? "Vessel"}-added</Badge>
        ) : row.isNew ? (
          <Badge tone="accent" className="ml-1">★ New</Badge>
        ) : row.ratingChangeNote ? (
          <Badge tone="warning" className="ml-1">↻ Revised</Badge>
        ) : null}
      </td>
      <td className="px-3 py-2 font-medium">{row.consequence}</td>
      <td className="px-3 py-2 max-w-xs whitespace-pre-wrap text-muted-foreground">{row.causes}</td>
      <td className="px-3 py-2 tabular-nums">{row.severity}</td>
      <td className="px-3 py-2 tabular-nums">{row.likelihood}</td>
      <td className="px-3 py-2">
        <Badge tone={bandTone(rBand)}>{rf}</Badge>
      </td>
      <td className="px-3 py-2 max-w-xs whitespace-pre-wrap">{row.existingControls}</td>
      <td className="px-3 py-2 max-w-xs whitespace-pre-wrap">{row.additionalControls || "—"}</td>
      <td className="px-3 py-2 tabular-nums">{resL}</td>
      <td className="px-3 py-2">
        <Badge tone={bandTone(resBand)}>{resRf}</Badge>
      </td>
      <td className="px-3 py-2 text-muted-foreground">{row.responsible || "—"}</td>
      {showActionsColumn && (
        <td className="px-3 py-2">
          {editable && (
            <div className="flex flex-col items-end gap-1">
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setIsEditing(true)} disabled={pending}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={remove} disabled={pending}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              {error && <p className="text-xs text-danger">{error}</p>}
            </div>
          )}
        </td>
      )}
    </tr>
  );
}
