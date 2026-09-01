"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
import { AutoGrowInput, Input, Label, Textarea } from "@/components/ui/input";
import { VesselField } from "@/components/ui/vessel-field";
import { Button } from "@/components/ui/button";

function ReportSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" name="intent" value="report" disabled={pending}>
      {pending ? "Reporting…" : "Report Meeting"}
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

type OthersRow = { key: string; label: string; details: string };

export function NewMeetingForm({
  vessels,
  isShipboard,
  ownVesselId,
  ownVesselName,
}: {
  vessels: { id: string; name: string }[];
  isShipboard: boolean;
  ownVesselId: string | null;
  ownVesselName: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  // The browser resets every field in the <form> the moment a form action
  // resolves — even on a rejected (fail()) result. Capture what was
  // submitted so a failed submission only has to point at what's missing,
  // not force the user to retype everything else. Same pattern as
  // near-miss/new/new-near-miss-form.tsx.
  const lastSubmittedFormData = useRef<FormData | null>(null);

  async function guardedCreateCommitteeMeetingAction(
    prev: ActionResult,
    formData: FormData,
  ): Promise<ActionResult> {
    lastSubmittedFormData.current = formData;
    return createCommitteeMeetingAction(prev, formData);
  }

  const [state, formAction] = useActionState<ActionResult, FormData>(
    guardedCreateCommitteeMeetingAction,
    { ok: false, error: null },
  );

  const [selectedTypes, setSelectedTypes] = useState<Set<CommitteeTypeValue>>(new Set(["SAFETY"]));
  const [details, setDetails] = useState<Record<string, string>>({});
  const [othersRows, setOthersRows] = useState<OthersRow[]>([]);

  // Runs after every rejected submission — repairs the fields the browser
  // just wiped (plain inputs directly on the DOM; the meeting-type
  // checkboxes and their agenda rows via React state, reconstructed from
  // the agendaCommitteeType/agendaCode/agendaLabel/agendaDetails arrays
  // that were actually submitted).
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
    ["vesselId", "position", "meetingDate", "meetingTime", "chairman",
      "inCharge", "members", "inAttendance", "forAcknowledgement",
    ].forEach(restore);

    const agendaCommitteeTypes = fd.getAll("agendaCommitteeType").map(String);
    const agendaCodes = fd.getAll("agendaCode").map(String);
    const agendaLabels = fd.getAll("agendaLabel").map(String);
    const agendaDetailsArr = fd.getAll("agendaDetails").map(String);

    const restoredTypes = new Set(
      agendaCommitteeTypes.filter(Boolean),
    ) as Set<CommitteeTypeValue>;
    setSelectedTypes(restoredTypes);

    const newDetails: Record<string, string> = {};
    const newOthersRows: OthersRow[] = [];
    agendaCommitteeTypes.forEach((type, i) => {
      const detail = agendaDetailsArr[i] ?? "";
      if (type === "OTHERS") {
        newOthersRows.push({ key: crypto.randomUUID(), label: agendaLabels[i] ?? "", details: detail });
      } else {
        newDetails[`${type}-${agendaCodes[i]}`] = detail;
      }
    });
    setDetails(newDetails);
    setOthersRows(newOthersRows);
  }, [state]);

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
        <form ref={formRef} action={formAction} className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <VesselField
              vessels={vessels}
              isShipboard={isShipboard}
              ownVesselId={ownVesselId}
              ownVesselName={ownVesselName}
              blankLabel="— Shore / Office —"
            />
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
                      <Label className="text-sm">{item.code}) {item.label}</Label>
                      <AutoGrowInput
                        name="agendaDetails"
                        className="max-h-none"
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
                      className="max-h-none"
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

          {state.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
          <div className="flex items-center gap-2">
            <ReportSubmitButton />
            <DraftSubmitButton />
            <Link href="/meetings"><Button type="button" variant="ghost">Cancel</Button></Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
