"use client";

import Link from "next/link";
import { useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Plus } from "lucide-react";
import {
  createIncidentAction,
  type ActionResult,
} from "@/features/incidents/actions";
import {
  INCIDENT_TYPES,
  INCIDENT_TYPE_LABELS,
  INCIDENT_SUBCATEGORIES,
  INCIDENT_SUBCATEGORY_LABELS,
  type IncidentTypeValue,
} from "@/features/incidents/schema";
import { Card, CardContent } from "@/components/ui/card";
import { AutoGrowInput, Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Reporting…" : "Report incident"}
    </Button>
  );
}

export function NewIncidentForm({
  vessels,
  positions,
}: {
  vessels: { id: string; name: string }[];
  positions: readonly string[];
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    createIncidentAction,
    { ok: false, error: null },
  );

  const [checkedTypes, setCheckedTypes] = useState<Set<IncidentTypeValue>>(new Set());
  const [sofRowCount, setSofRowCount] = useState(1);

  function toggleType(type: IncidentTypeValue, checked: boolean) {
    setCheckedTypes((prev) => {
      const next = new Set(prev);
      if (checked) next.add(type);
      else next.delete(type);
      return next;
    });
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <form action={formAction} className="space-y-6">
          {/* Basics */}
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <AutoGrowInput id="title" name="title" placeholder="Brief summary of the incident" required />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="reporterName">Name of Reporter</Label>
              <AutoGrowInput id="reporterName" name="reporterName" placeholder="Full name" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reporterPosition">Position / Rank</Label>
              <Select id="reporterPosition" name="reporterPosition" defaultValue="" required>
                <option value="" disabled>— Select position —</option>
                {positions.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </Select>
            </div>
          </div>

          {/* FIELD 1 — Type of Incident (multi-select), each with its own
              sub-category dropdown once checked. */}
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
                        <Select id={`sub_${t}`} name={`sub_${t}`} defaultValue="">
                          <option value="" disabled>— Select sub-category —</option>
                          {INCIDENT_SUBCATEGORIES[t].map((s) => (
                            <option key={s} value={s}>{INCIDENT_SUBCATEGORY_LABELS[t][s]}</option>
                          ))}
                        </Select>
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
              <Input id="occurredAt" name="occurredAt" type="date" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vesselId">Vessel</Label>
              <Select id="vesselId" name="vesselId" defaultValue="">
                <option value="">— Shore / N/A —</option>
                {vessels.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="location">Location</Label>
            <AutoGrowInput id="location" name="location" placeholder="e.g. Cargo manifold, main deck" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">What happened</Label>
            <AutoGrowInput id="description" name="description" required placeholder="Describe the sequence of events…" />
          </div>

          {/* Statement of Facts — chronological timeline of events/response */}
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
                        <Input name="sofTime" placeholder="0840 LT" />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <AutoGrowInput name="sofEvent" placeholder="Describe the event…" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSofRowCount((n) => n + 1)}
            >
              <Plus className="h-4 w-4" /> Add row
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="immediateAction">Immediate action taken</Label>
            <AutoGrowInput id="immediateAction" name="immediateAction" placeholder="Actions taken to make the situation safe…" />
          </div>

          {/* No root cause / human factors here — this is the initial report
              (facts as known at the time). Root cause is established later,
              during investigation, on the incident detail page. */}

          {state.error && (
            <p className="text-sm text-danger" role="alert">{state.error}</p>
          )}
          <div className="flex items-center gap-2">
            <SubmitButton />
            <Link href="/incidents"><Button type="button" variant="ghost">Cancel</Button></Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
