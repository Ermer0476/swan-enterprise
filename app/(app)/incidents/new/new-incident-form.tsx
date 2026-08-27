"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Plus, ClipboardPaste } from "lucide-react";
import {
  createIncidentAction,
  type ActionResult,
} from "@/features/incidents/actions";
import {
  INCIDENT_TYPES,
  INCIDENT_TYPE_LABELS,
  parseSofPasteText,
  type IncidentTypeValue,
  type SofRow,
} from "@/features/incidents/schema";
import type { IncidentSubcategoryOptions } from "@/features/incidents/queries";
import type { ReferenceOption } from "@/lib/reference-registry";
import { Card, CardContent } from "@/components/ui/card";
import { AutoGrowInput, Input, Label, Select } from "@/components/ui/input";
import { VesselField } from "@/components/ui/vessel-field";
import { Button } from "@/components/ui/button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" name="intent" value="report" disabled={pending}>
      {pending ? "Reporting…" : "Report incident"}
    </Button>
  );
}

function DraftSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" name="intent" value="draft" variant="outline" disabled={pending}>
      {pending ? "Saving…" : "Save as Draft"}
    </Button>
  );
}

export function NewIncidentForm({
  vessels,
  positions,
  subcategoryOptions,
  isShipboard,
  ownVesselId,
  ownVesselName,
}: {
  vessels: { id: string; name: string }[];
  positions: ReferenceOption[];
  subcategoryOptions: IncidentSubcategoryOptions;
  isShipboard: boolean;
  ownVesselId: string | null;
  ownVesselName: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  // The browser resets every field in the <form> the moment a form action
  // resolves — even on a rejected (fail()) result. Capture what was
  // submitted so a failed validation only has to point at what's missing,
  // not force the reporter to retype everything else. Same pattern as
  // near-miss/new/new-near-miss-form.tsx.
  const lastSubmittedFormData = useRef<FormData | null>(null);
  const pendingSubCategoryRestore = useRef<Record<string, string>>({});

  async function guardedCreateIncidentAction(
    prev: ActionResult,
    formData: FormData,
  ): Promise<ActionResult> {
    lastSubmittedFormData.current = formData;
    return createIncidentAction(prev, formData);
  }

  const [state, formAction] = useActionState<ActionResult, FormData>(
    guardedCreateIncidentAction,
    { ok: false, error: null },
  );

  const [checkedTypes, setCheckedTypes] = useState<Set<IncidentTypeValue>>(new Set());
  const [sofRowCount, setSofRowCount] = useState(1);
  const [sofPasteOpen, setSofPasteOpen] = useState(false);
  const [sofPasteText, setSofPasteText] = useState("");
  const pendingSofRows = useRef<SofRow[] | null>(null);

  function toggleType(type: IncidentTypeValue, checked: boolean) {
    setCheckedTypes((prev) => {
      const next = new Set(prev);
      if (checked) next.add(type);
      else next.delete(type);
      return next;
    });
  }

  // Runs after every rejected submission — repairs the fields the browser
  // just wiped (plain inputs directly on the DOM; type checkboxes and their
  // sub-category selects via React state) using exactly what was typed.
  useEffect(() => {
    if (state.ok || !state.error) return;
    const fd = lastSubmittedFormData.current;
    const form = formRef.current;
    if (!fd || !form) return;

    const restore = (name: string) => {
      const el = form.elements.namedItem(name) as
        | HTMLInputElement
        | HTMLSelectElement
        | HTMLTextAreaElement
        | null;
      if (!el) return;
      el.value = String(fd.get(name) ?? "");
      // AutoGrowInput only re-measures its height on an "input" event; a
      // direct .value write doesn't fire one, so it'd render collapsed.
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    ["title", "reporterName", "reporterPosition", "occurredAt", "location",
      "description", "immediateAction",
    ].forEach(restore);

    const restoredTypes = new Set(fd.getAll("types").map(String)) as Set<IncidentTypeValue>;
    setCheckedTypes(restoredTypes);

    // Sub-category selects only exist in the DOM once their parent type is
    // checked, so stash the values and apply them in the effect below once
    // checkedTypes flips and the selects actually mount.
    const subPending: Record<string, string> = {};
    restoredTypes.forEach((t) => {
      const val = fd.get(`sub_${t}`);
      if (val) subPending[t] = String(val);
    });
    pendingSubCategoryRestore.current = subPending;

    const sofTimes = fd.getAll("sofTime").map(String);
    const sofEvents = fd.getAll("sofEvent").map(String);
    form.querySelectorAll<HTMLInputElement>('[name="sofTime"]').forEach((el, i) => {
      el.value = sofTimes[i] ?? "";
    });
    form.querySelectorAll<HTMLInputElement>('[name="sofEvent"]').forEach((el, i) => {
      el.value = sofEvents[i] ?? "";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }, [state]);

  // Sub-category selects mount only for checked types, so restore their
  // values on the render right after checkedTypes flips them into the DOM.
  useEffect(() => {
    const pending = pendingSubCategoryRestore.current;
    if (Object.keys(pending).length === 0) return;
    const form = formRef.current;
    if (!form) return;
    for (const [t, val] of Object.entries(pending)) {
      const el = form.elements.namedItem(`sub_${t}`) as HTMLSelectElement | null;
      if (el) el.value = val;
    }
    pendingSubCategoryRestore.current = {};
  }, [checkedTypes]);

  // The SOF row inputs only exist once sofRowCount renders enough of them —
  // apply a pasted-and-parsed set of rows on the render right after, same
  // pattern as the sub-category restore above.
  useEffect(() => {
    const rows = pendingSofRows.current;
    if (!rows) return;
    const form = formRef.current;
    if (!form) return;
    const timeEls = form.querySelectorAll<HTMLInputElement>('[name="sofTime"]');
    const eventEls = form.querySelectorAll<HTMLTextAreaElement>('[name="sofEvent"]');
    rows.forEach((row, i) => {
      const timeEl = timeEls[i];
      const eventEl = eventEls[i];
      if (timeEl) timeEl.value = row.time;
      if (eventEl) {
        eventEl.value = row.event;
        // AutoGrowInput only re-measures its height on an "input" event.
        eventEl.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    pendingSofRows.current = null;
  }, [sofRowCount]);

  function applySofPaste() {
    const rows = parseSofPasteText(sofPasteText);
    if (rows.length === 0) return;
    pendingSofRows.current = rows;
    setSofRowCount(rows.length);
    setSofPasteText("");
    setSofPasteOpen(false);
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <form ref={formRef} action={formAction} className="space-y-6">
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
                  <option key={p.value} value={p.value}>{p.label}</option>
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
                          {subcategoryOptions[t].map((s) => (
                            <option key={s.value} value={s.value}>{s.label}</option>
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
            <VesselField
              vessels={vessels}
              isShipboard={isShipboard}
              ownVesselId={ownVesselId}
              ownVesselName={ownVesselName}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="location">Vessel Position</Label>
            <AutoGrowInput
              id="location"
              name="location"
              placeholder="e.g. 01°15'N 103°50'E, At Berth Singapore, At Singapore Anchorage"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">What happened</Label>
            <AutoGrowInput id="description" name="description" required placeholder="Describe the sequence of events…" />
          </div>

          {/* Statement of Facts — chronological timeline of events/response */}
          <div className="space-y-2">
            <Label>Statement of Facts (SOF)</Label>

            {sofPasteOpen && (
              <div className="space-y-2 rounded-md border border-dashed border-border p-3">
                <Label className="text-xs">
                  Paste a SOF block — one fact per line, each starting with its time (e.g. "0730H - Pilot onboard.")
                </Label>
                <textarea
                  value={sofPasteText}
                  onChange={(e) => setSofPasteText(e.target.value)}
                  rows={8}
                  className="w-full resize-y rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder={"0730H - Pilot onboard.\n0748H - Commenced heaving up anchor.\n…"}
                />
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" disabled={!sofPasteText.trim()} onClick={applySofPaste}>
                    Fill rows
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSofPasteOpen(false);
                      setSofPasteText("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

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
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSofRowCount((n) => n + 1)}
              >
                <Plus className="h-4 w-4" /> Add row
              </Button>
              {!sofPasteOpen && (
                <Button type="button" variant="outline" size="sm" onClick={() => setSofPasteOpen(true)}>
                  <ClipboardPaste className="h-4 w-4" /> Paste SOF
                </Button>
              )}
            </div>
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
            <DraftSubmitButton />
            <Link href="/incidents"><Button type="button" variant="ghost">Cancel</Button></Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
