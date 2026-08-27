"use client";

import { useRef, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Plus } from "lucide-react";
import {
  updateDraftIncidentAction,
  type ActionResult,
} from "@/features/incidents/actions";
import {
  INCIDENT_TYPES,
  INCIDENT_TYPE_LABELS,
  type IncidentTypeValue,
} from "@/features/incidents/schema";
import type { IncidentSubcategoryOptions } from "@/features/incidents/queries";
import type { ReferenceOption } from "@/lib/reference-registry";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AutoGrowInput, Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save changes"}
    </Button>
  );
}

export type EditableIncident = {
  id: string;
  title: string;
  reporterName: string;
  reporterPosition: string;
  occurredAt: string; // yyyy-mm-dd
  location: string | null;
  description: string;
  immediateAction: string | null;
  typeEntries: { type: IncidentTypeValue; subCategory: string }[];
  sofEntries: { time: string; event: string }[];
};

/**
 * Full edit of a Draft's own report fields. Only ever rendered for the
 * draft's own reporter — any shipboard user, or the specific office user
 * who created it (see [id]/page.tsx's isOwnDraft gate). The vessel field is
 * locked either way (never resubmitted by this form), so unlike the create
 * form there's no shipboard/office vessel-picker branch here.
 */
export function EditDraftIncidentForm({
  incident,
  positions,
  subcategoryOptions,
  ownVesselName,
}: {
  incident: EditableIncident;
  positions: ReferenceOption[];
  subcategoryOptions: IncidentSubcategoryOptions;
  ownVesselName: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction] = useActionState<ActionResult, FormData>(
    (prev, formData) => updateDraftIncidentAction(incident.id, prev, formData),
    { ok: false, error: null },
  );

  const [checkedTypes, setCheckedTypes] = useState<Set<IncidentTypeValue>>(
    new Set(incident.typeEntries.map((e) => e.type)),
  );
  const subCategoryByType = new Map(incident.typeEntries.map((e) => [e.type, e.subCategory]));
  const [sofRowCount, setSofRowCount] = useState(Math.max(1, incident.sofEntries.length));

  function toggleType(type: IncidentTypeValue, checked: boolean) {
    setCheckedTypes((prev) => {
      const next = new Set(prev);
      if (checked) next.add(type);
      else next.delete(type);
      return next;
    });
  }

  return (
    <Card className="mb-6">
      <CardHeader><CardTitle>Edit Draft</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <form ref={formRef} action={formAction} className="space-y-6">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <AutoGrowInput id="title" name="title" defaultValue={incident.title} placeholder="Brief summary of the incident" required />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="reporterName">Name of Reporter</Label>
              <AutoGrowInput id="reporterName" name="reporterName" defaultValue={incident.reporterName} placeholder="Full name" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reporterPosition">Position / Rank</Label>
              <Select id="reporterPosition" name="reporterPosition" defaultValue={incident.reporterPosition} required>
                <option value="" disabled>— Select position —</option>
                {/* Keep a persisted-but-now-hidden position selectable so
                    re-saving the draft never drops it. */}
                {incident.reporterPosition &&
                  !positions.some((p) => p.value === incident.reporterPosition) && (
                    <option value={incident.reporterPosition}>{incident.reporterPosition} (hidden)</option>
                  )}
                {positions.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </Select>
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              Type of incident <span className="text-muted-foreground">(select all that apply)</span>
            </legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {INCIDENT_TYPES.map((t) => {
                const checked = checkedTypes.has(t);
                return (
                  <div key={t} className="rounded-md border border-border">
                    <label className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/40">
                      <input
                        type="checkbox"
                        name="types"
                        value={t}
                        checked={checked}
                        onChange={(e) => toggleType(t, e.target.checked)}
                        className="h-4 w-4"
                      />
                      {INCIDENT_TYPE_LABELS[t]}
                    </label>
                    {checked && (
                      <div className="space-y-1.5 border-t border-border bg-muted/40 p-3">
                        <Label htmlFor={`sub_${t}`}>{INCIDENT_TYPE_LABELS[t]} sub-category</Label>
                        {(() => {
                          const persisted = subCategoryByType.get(t);
                          const opts = subcategoryOptions[t];
                          // Keep the record's saved value selectable even if
                          // the office has since hidden it, so re-saving the
                          // draft never silently drops it.
                          const showPersisted =
                            !!persisted && !opts.some((o) => o.value === persisted);
                          return (
                            <Select id={`sub_${t}`} name={`sub_${t}`} defaultValue={persisted ?? ""}>
                              <option value="" disabled>— Select sub-category —</option>
                              {showPersisted && (
                                <option value={persisted}>{persisted} (hidden)</option>
                              )}
                              {opts.map((s) => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                              ))}
                            </Select>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="occurredAt">Occurred at</Label>
              <Input id="occurredAt" name="occurredAt" type="date" defaultValue={incident.occurredAt} required />
            </div>
            <div className="space-y-1.5">
              <Label>Vessel</Label>
              <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                {ownVesselName ?? "— No vessel assigned —"}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="location">Vessel Position</Label>
            <AutoGrowInput
              id="location"
              name="location"
              defaultValue={incident.location ?? ""}
              placeholder="e.g. 01°15'N 103°50'E, At Berth Singapore, At Singapore Anchorage"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">What happened</Label>
            <AutoGrowInput id="description" name="description" defaultValue={incident.description} required placeholder="Describe the sequence of events…" />
          </div>

          <div className="space-y-2">
            <Label>Statement of Facts (SOF)</Label>
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-28" />
                  <col />
                </colgroup>
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Time</th>
                    <th className="px-3 py-2 font-medium">Event</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: sofRowCount }).map((_, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-2 align-top">
                        <Input name="sofTime" defaultValue={incident.sofEntries[i]?.time ?? ""} placeholder="0840 LT" />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <AutoGrowInput name="sofEvent" defaultValue={incident.sofEntries[i]?.event ?? ""} placeholder="Describe the event…" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setSofRowCount((n) => n + 1)}>
              <Plus className="h-4 w-4" /> Add row
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="immediateAction">Immediate action taken</Label>
            <AutoGrowInput id="immediateAction" name="immediateAction" defaultValue={incident.immediateAction ?? ""} placeholder="Actions taken to make the situation safe…" />
          </div>

          {state.error && (
            <p className="text-sm text-danger" role="alert">{state.error}</p>
          )}
          <div className="flex items-center gap-2">
            <SaveButton />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
