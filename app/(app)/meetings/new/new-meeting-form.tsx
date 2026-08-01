"use client";

import Link from "next/link";
import { useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Plus, X } from "lucide-react";
import {
  createCommitteeMeetingAction,
  type ActionResult,
} from "@/features/committee-meetings/actions";
import {
  COMMITTEE_TYPES,
  COMMITTEE_TYPE_LABELS,
  COMMITTEE_COMPOSITION,
  AGENDA_TEMPLATES,
  type CommitteeTypeValue,
} from "@/features/committee-meetings/schema";
import { Card, CardContent } from "@/components/ui/card";
import { AutoGrowInput, Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Record Meeting"}
    </Button>
  );
}

type OthersRow = { key: string; label: string; details: string };

export function NewMeetingForm({
  vessels,
}: {
  vessels: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    createCommitteeMeetingAction,
    { ok: false, error: null },
  );

  const [selectedTypes, setSelectedTypes] = useState<Set<CommitteeTypeValue>>(new Set(["SAFETY"]));
  const [details, setDetails] = useState<Record<string, string>>({});
  const [othersRows, setOthersRows] = useState<OthersRow[]>([]);

  function toggleType(t: CommitteeTypeValue, checked: boolean) {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (checked) next.add(t);
      else next.delete(t);
      return next;
    });
    if (checked && t === "OTHERS" && othersRows.length === 0) {
      setOthersRows([{ key: crypto.randomUUID(), label: "", details: "" }]);
    }
  }

  function addOthersRow() {
    setOthersRows((prev) => [...prev, { key: crypto.randomUUID(), label: "", details: "" }]);
  }
  function removeOthersRow(key: string) {
    setOthersRows((prev) => prev.filter((r) => r.key !== key));
  }
  function updateOthersRow(key: string, field: "label" | "details", value: string) {
    setOthersRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  }

  const fixedTypesSelected = COMMITTEE_TYPES.filter(
    (t): t is Exclude<CommitteeTypeValue, "OTHERS"> => t !== "OTHERS" && selectedTypes.has(t),
  );

  return (
    <Card>
      <CardContent className="pt-5">
        <form action={formAction} className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="vesselId">Vessel</Label>
              <Select id="vesselId" name="vesselId" defaultValue="">
                <option value="">— Shore / Office —</option>
                {vessels.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="position">Position</Label>
              <AutoGrowInput id="position" name="position" placeholder="e.g. Tema, Ghana — Anchorage" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="meetingDate">Date</Label>
              <Input id="meetingDate" name="meetingDate" type="date" required />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="meetingTime">Time</Label>
              <AutoGrowInput id="meetingTime" name="meetingTime" placeholder="e.g. 1100H-1130" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="chairman">Chairman</Label>
              <AutoGrowInput id="chairman" name="chairman" placeholder="Name / rank" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inCharge">In-charge</Label>
              <AutoGrowInput id="inCharge" name="inCharge" placeholder="Name / rank" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="members">Members</Label>
              <Textarea id="members" name="members" rows={3} placeholder="One per line…" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inAttendance">In attendance</Label>
              <Textarea id="inAttendance" name="inAttendance" rows={3} placeholder="One per line…" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="forAcknowledgement">For acknowledgement</Label>
              <Textarea id="forAcknowledgement" name="forAcknowledgement" rows={3} placeholder="Absentees who must acknowledge later…" />
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Type of meeting (select all that apply)</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {COMMITTEE_TYPES.map((t) => (
                <label key={t} className="flex items-start gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/40">
                  <input
                    type="checkbox"
                    checked={selectedTypes.has(t)}
                    onChange={(e) => toggleType(t, e.target.checked)}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span>
                    {COMMITTEE_TYPE_LABELS[t]}
                    {t !== "OTHERS" && (
                      <span className="block text-xs text-muted-foreground">{COMMITTEE_COMPOSITION[t]}</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-6">
            {fixedTypesSelected.map((type) => (
              <div key={type} className="space-y-3 rounded-md border border-border p-4">
                <h4 className="text-sm font-semibold">{COMMITTEE_TYPE_LABELS[type]}</h4>
                {AGENDA_TEMPLATES[type].map((item) => {
                  const key = `${type}-${item.code}`;
                  return (
                    <div key={key} className="space-y-1.5 border-t border-border pt-3 first:border-0 first:pt-0">
                      <input type="hidden" name="agendaId" value="" />
                      <input type="hidden" name="agendaCommitteeType" value={type} />
                      <input type="hidden" name="agendaCode" value={item.code} />
                      <input type="hidden" name="agendaLabel" value={item.label} />
                      <input type="hidden" name="agendaShoreComments" value="" />
                      <Label className="text-sm">{item.code}) {item.label}</Label>
                      <AutoGrowInput
                        name="agendaDetails"
                        value={details[key] ?? ""}
                        onChange={(e) => setDetails((prev) => ({ ...prev, [key]: e.target.value }))}
                        placeholder="Discussion details…"
                      />
                    </div>
                  );
                })}
              </div>
            ))}

            {selectedTypes.has("OTHERS") && (
              <div className="space-y-3 rounded-md border border-border p-4">
                <h4 className="text-sm font-semibold">{COMMITTEE_TYPE_LABELS.OTHERS}</h4>
                {othersRows.map((row) => (
                  <div key={row.key} className="space-y-1.5 border-t border-border pt-3 first:border-0 first:pt-0">
                    <input type="hidden" name="agendaId" value="" />
                    <input type="hidden" name="agendaCommitteeType" value="OTHERS" />
                    <input type="hidden" name="agendaCode" value="" />
                    <input type="hidden" name="agendaShoreComments" value="" />
                    <div className="flex items-end gap-2">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Topic</Label>
                        <AutoGrowInput
                          name="agendaLabel"
                          value={row.label}
                          onChange={(e) => updateOthersRow(row.key, "label", e.target.value)}
                          placeholder="e.g. SIRE 2.0 Inspection"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeOthersRow(row.key)}
                        aria-label="Remove topic"
                        className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-danger"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <AutoGrowInput
                      name="agendaDetails"
                      value={row.details}
                      onChange={(e) => updateOthersRow(row.key, "details", e.target.value)}
                      placeholder="Discussion details…"
                    />
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addOthersRow}>
                  <Plus className="h-4 w-4" /> Add topic
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vesselRemarks">Vessel remarks</Label>
            <AutoGrowInput id="vesselRemarks" name="vesselRemarks" placeholder="Master's overall closing remarks…" />
          </div>

          {state.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
          <div className="flex items-center gap-2">
            <SubmitButton />
            <Link href="/meetings"><Button type="button" variant="ghost">Cancel</Button></Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
